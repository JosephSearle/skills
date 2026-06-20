# RAG Patterns Reference — LCEL, LangGraph, Advanced RAG

## Pattern Selection Guide

| Pattern | When to use | Complexity | Key dependency |
|---|---|---|---|
| Basic LCEL chain | Baseline; most use-cases | Low | `langchain-core` |
| LCEL with sources | When callers need source documents alongside answer | Low | `langchain-core` |
| LangGraph RAG | When you need self-correction, grading, branching | Medium | `langgraph` |
| Agentic RAG | Multi-source retrieval decided at runtime | Medium | `langgraph` + tool calling |
| Self-RAG | Hallucination/groundedness checking | High | `langgraph` + grader LLMs |
| Query decomposition | Multi-hop questions | Medium | `langgraph` |
| HyDE | Vocabulary mismatch between queries and documents | Low–Medium | Extra LLM call |
| CRAG | Retrieval gaps cause hallucinations | Medium | `langgraph` + web search |
| Adaptive RAG | Mixed query difficulty (easy lookups + hard reasoning) | Medium | `langgraph` + classifier |

---

## Basic LCEL RAG Chain

The canonical production default. The `{"context": ..., "question": ...}` dict step runs
the retriever and passthrough in parallel — retrieval does not block on question formatting.

```python
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# ── Store setup ──────────────────────────────────────────────────────────────
client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="rag_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
store = QdrantVectorStore(
    client=client,
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# Seed with documents
store.add_documents([
    Document(page_content="Task decomposition breaks a complex task into subtasks.", metadata={"source": "guide.txt"}),
    Document(page_content="Chain-of-thought prompting improves reasoning step-by-step.", metadata={"source": "guide.txt"}),
])

# ── Chain ────────────────────────────────────────────────────────────────────
retriever = store.as_retriever(search_kwargs={"k": 5})

def format_docs(docs: list[Document]) -> str:
    return "\n\n".join(d.page_content for d in docs)

prompt = ChatPromptTemplate.from_template(
    "Answer based only on the following context. "
    "If the answer is not in the context, say 'I don't know'.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}"
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# Invoke
answer: str = rag_chain.invoke("What is task decomposition?")

# Stream (retrieval runs first; answer tokens stream after)
for chunk in rag_chain.stream("What is chain-of-thought prompting?"):
    print(chunk, end="", flush=True)
```

---

## LCEL with Sources Passthrough

Returns both the answer and the source documents in a single call.

```python
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})

def format_docs(docs: list[Document]) -> str:
    return "\n\n".join(
        f"[{i+1}] {d.page_content} (source: {d.metadata.get('source', 'unknown')})"
        for i, d in enumerate(docs)
    )

prompt = ChatPromptTemplate.from_template(
    "Answer using only the context. Cite sources by number.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}"
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# Split chain: context docs captured before being formatted
rag_from_docs = (
    RunnablePassthrough.assign(context=lambda x: format_docs(x["context"]))
    | prompt
    | llm
    | StrOutputParser()
)

rag_with_source = RunnableParallel(
    {"context": retriever, "question": RunnablePassthrough()}
).assign(answer=rag_from_docs)

# Returns: {"context": [Document, ...], "question": str, "answer": str}
result: dict = rag_with_source.invoke("What is task decomposition?")
print(result["answer"])
print("Sources:", [d.metadata.get("source") for d in result["context"]])
```

---

## LangGraph RAG — StateGraph with Retrieval and Generation Nodes

Graduate from LCEL to LangGraph when you need conditional branching, retries, or
grading. The pattern: typed `State`, nodes as plain functions, edges controlling flow.

```python
from __future__ import annotations

import operator
from typing import Annotated, TypedDict
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langgraph.graph import StateGraph, END
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# ── State ────────────────────────────────────────────────────────────────────
class RAGState(TypedDict):
    question: str
    documents: list[Document]
    answer: str

# ── Store and retriever ──────────────────────────────────────────────────────
client = QdrantClient(url="http://localhost:6333")
store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})

# ── LLM ──────────────────────────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# ── Nodes ────────────────────────────────────────────────────────────────────
def retrieve(state: RAGState) -> RAGState:
    docs = retriever.invoke(state["question"])
    return {**state, "documents": docs}

def generate(state: RAGState) -> RAGState:
    context = "\n\n".join(d.page_content for d in state["documents"])
    prompt = ChatPromptTemplate.from_template(
        "Answer based only on context.\n\nContext:\n{context}\n\nQuestion: {question}"
    )
    chain = prompt | llm | StrOutputParser()
    answer = chain.invoke({"context": context, "question": state["question"]})
    return {**state, "answer": answer}

# ── Graph ────────────────────────────────────────────────────────────────────
workflow = StateGraph(RAGState)
workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

graph = workflow.compile()

result = graph.invoke({"question": "What is task decomposition?", "documents": [], "answer": ""})
print(result["answer"])
```

---

## Agentic RAG — Retriever as Tool

The LLM agent decides when to call the retriever vs. answer from memory.

```python
from __future__ import annotations

from langchain_core.tools import tool
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langgraph.prebuilt import create_react_agent

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})

@tool
def retrieve_docs(query: str) -> str:
    """Search the knowledge base for information relevant to the query."""
    docs: list[Document] = retriever.invoke(query)
    return "\n\n".join(
        f"Source: {d.metadata.get('source', 'unknown')}\n{d.page_content}"
        for d in docs
    )

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# ReAct agent with retriever tool
agent = create_react_agent(
    model=llm,
    tools=[retrieve_docs],
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "What is task decomposition and why is it useful?"}]
})
print(result["messages"][-1].content)
```

---

## Self-RAG — Graded Retrieval with Groundedness Checking

Three grader nodes: document relevance, generation groundedness (hallucination check),
and answer usefulness. Failing grades trigger query rewrite and re-retrieval.

```python
from __future__ import annotations

from typing import Literal, TypedDict
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

# ── State ────────────────────────────────────────────────────────────────────
class SelfRAGState(TypedDict):
    question: str
    documents: list[Document]
    generation: str
    retry_count: int

MAX_RETRIES = 3

# ── Grader schemas ────────────────────────────────────────────────────────────
class RelevanceGrade(BaseModel):
    binary_score: Literal["yes", "no"] = Field(description="Is the document relevant to the question?")

class GroundednessGrade(BaseModel):
    binary_score: Literal["yes", "no"] = Field(description="Is the answer grounded in the documents?")

class UsefulnessGrade(BaseModel):
    binary_score: Literal["yes", "no"] = Field(description="Does the answer address the question?")

# ── LLM and store ─────────────────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
grader_llm = llm.with_structured_output(RelevanceGrade)
groundedness_llm = llm.with_structured_output(GroundednessGrade)
usefulness_llm = llm.with_structured_output(UsefulnessGrade)

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})

# ── Nodes ──────────────────────────────────────────────────────────────────────
def retrieve_node(state: SelfRAGState) -> SelfRAGState:
    docs = retriever.invoke(state["question"])
    return {**state, "documents": docs}

def grade_documents_node(state: SelfRAGState) -> SelfRAGState:
    grade_prompt = ChatPromptTemplate.from_template(
        "Document: {document}\n\nQuestion: {question}\n\nIs this document relevant?"
    )
    chain = grade_prompt | grader_llm
    relevant_docs = [
        doc for doc in state["documents"]
        if chain.invoke({"document": doc.page_content, "question": state["question"]}).binary_score == "yes"
    ]
    return {**state, "documents": relevant_docs}

def generate_node(state: SelfRAGState) -> SelfRAGState:
    context = "\n\n".join(d.page_content for d in state["documents"])
    gen_prompt = ChatPromptTemplate.from_template(
        "Answer based only on context.\n\nContext:\n{context}\n\nQuestion: {question}"
    )
    generation = (gen_prompt | llm).invoke(
        {"context": context, "question": state["question"]}
    ).content
    return {**state, "generation": generation}

def rewrite_query_node(state: SelfRAGState) -> SelfRAGState:
    rewrite_prompt = ChatPromptTemplate.from_template(
        "Rewrite this question to improve retrieval results: {question}"
    )
    new_question = (rewrite_prompt | llm).invoke({"question": state["question"]}).content
    return {**state, "question": new_question, "retry_count": state["retry_count"] + 1}

# ── Conditional edges ──────────────────────────────────────────────────────────
def should_generate(state: SelfRAGState) -> Literal["generate", "rewrite_query"]:
    if not state["documents"] or state["retry_count"] >= MAX_RETRIES:
        return "generate"
    return "generate"   # proceed to generate after grading

def check_groundedness(state: SelfRAGState) -> Literal["useful", "not_grounded"]:
    ground_prompt = ChatPromptTemplate.from_template(
        "Context: {context}\n\nAnswer: {generation}\n\nIs the answer grounded in the context?"
    )
    context = "\n\n".join(d.page_content for d in state["documents"])
    grade: GroundednessGrade = (ground_prompt | groundedness_llm).invoke(
        {"context": context, "generation": state["generation"]}
    )
    if grade.binary_score == "yes":
        use_prompt = ChatPromptTemplate.from_template(
            "Question: {question}\n\nAnswer: {generation}\n\nDoes this answer address the question?"
        )
        use_grade: UsefulnessGrade = (use_prompt | usefulness_llm).invoke(
            {"question": state["question"], "generation": state["generation"]}
        )
        return "useful" if use_grade.binary_score == "yes" else "not_grounded"
    return "not_grounded"

# ── Graph ──────────────────────────────────────────────────────────────────────
workflow = StateGraph(SelfRAGState)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("grade_documents", grade_documents_node)
workflow.add_node("generate", generate_node)
workflow.add_node("rewrite_query", rewrite_query_node)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "grade_documents")
workflow.add_conditional_edges("grade_documents", should_generate, {"generate": "generate", "rewrite_query": "rewrite_query"})
workflow.add_conditional_edges("generate", check_groundedness, {"useful": END, "not_grounded": "rewrite_query"})
workflow.add_edge("rewrite_query", "retrieve")

self_rag_graph = workflow.compile()

result = self_rag_graph.invoke({
    "question": "What is task decomposition?",
    "documents": [],
    "generation": "",
    "retry_count": 0,
})
print(result["generation"])
```

---

## HyDE — Hypothetical Document Embeddings

Generate a hypothetical answer first, embed it, then retrieve using that embedding.
Bridges vocabulary mismatch between user queries and document language.

**Cost:** one extra LLM call per retrieval.
**Bias risk:** the hypothetical answer may embed biases or incorrect assumptions that
steer retrieval away from accurate documents.

```python
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# Step 1: generate a hypothetical answer
hyde_prompt = ChatPromptTemplate.from_template(
    "Write a short paragraph that would answer this question if it appeared in a document:\n\n{question}"
)

# Step 2: use hypothetical answer as retrieval query, then generate real answer
answer_prompt = ChatPromptTemplate.from_template(
    "Answer based only on context.\n\nContext:\n{context}\n\nOriginal question: {question}"
)

def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

hyde_chain = (
    {"hypothetical_answer": hyde_prompt | llm | StrOutputParser(), "question": RunnablePassthrough()}
    | RunnablePassthrough.assign(
        context=lambda x: format_docs(retriever.invoke(x["hypothetical_answer"]))
    )
    | answer_prompt
    | llm
    | StrOutputParser()
)

answer = hyde_chain.invoke("What techniques improve LLM reasoning?")
```

---

## CRAG — Corrective RAG

A retrieval evaluator grades documents. If retrieval quality is insufficient, the graph
transforms the query and falls back to web search before generating.

```python
from __future__ import annotations

from typing import Literal, TypedDict
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

class CRAGState(TypedDict):
    question: str
    documents: list[Document]
    generation: str
    web_search_needed: bool

class RelevanceScore(BaseModel):
    score: Literal["yes", "no"] = Field(description="Is the document relevant?")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
relevance_llm = llm.with_structured_output(RelevanceScore)

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 5})

def retrieve_node(state: CRAGState) -> CRAGState:
    docs = retriever.invoke(state["question"])
    return {**state, "documents": docs}

def evaluate_retrieval_node(state: CRAGState) -> CRAGState:
    grade_prompt = ChatPromptTemplate.from_template(
        "Document: {document}\n\nQuestion: {question}\n\nIs this relevant?"
    )
    chain = grade_prompt | relevance_llm
    relevant_count = sum(
        1 for doc in state["documents"]
        if chain.invoke({"document": doc.page_content, "question": state["question"]}).score == "yes"
    )
    web_needed = relevant_count < len(state["documents"]) * 0.5
    return {**state, "web_search_needed": web_needed}

def web_search_node(state: CRAGState) -> CRAGState:
    # Use Tavily, DuckDuckGo, or any search tool
    from langchain_community.tools.tavily_search import TavilySearchResults
    search = TavilySearchResults(max_results=3)
    results = search.invoke(state["question"])
    web_docs = [
        Document(page_content=r["content"], metadata={"source": r["url"], "type": "web"})
        for r in results
    ]
    return {**state, "documents": web_docs}

def generate_node(state: CRAGState) -> CRAGState:
    context = "\n\n".join(d.page_content for d in state["documents"])
    gen_prompt = ChatPromptTemplate.from_template(
        "Answer based only on context.\n\nContext:\n{context}\n\nQuestion: {question}"
    )
    generation = (gen_prompt | llm).invoke(
        {"context": context, "question": state["question"]}
    ).content
    return {**state, "generation": generation}

def route_after_eval(state: CRAGState) -> Literal["web_search", "generate"]:
    return "web_search" if state["web_search_needed"] else "generate"

workflow = StateGraph(CRAGState)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("evaluate_retrieval", evaluate_retrieval_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("generate", generate_node)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "evaluate_retrieval")
workflow.add_conditional_edges(
    "evaluate_retrieval",
    route_after_eval,
    {"web_search": "web_search", "generate": "generate"},
)
workflow.add_edge("web_search", "generate")
workflow.add_edge("generate", END)

crag_graph = workflow.compile()

result = crag_graph.invoke({
    "question": "What is the latest LangGraph release?",
    "documents": [],
    "generation": "",
    "web_search_needed": False,
})
print(result["generation"])
```

---

## Query Decomposition

A decomposition node breaks a complex question into sub-questions, retrieves for each,
then synthesises. Improves multi-hop reasoning where a single query retrieves poorly.

```python
from __future__ import annotations

import asyncio
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever = store.as_retriever(search_kwargs={"k": 3})
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

decompose_prompt = ChatPromptTemplate.from_template(
    "Break this question into 2-4 simpler sub-questions, one per line:\n\n{question}"
)

answer_prompt = ChatPromptTemplate.from_template(
    "Using the retrieved context for each sub-question, answer the original question.\n\n"
    "Sub-question answers:\n{sub_answers}\n\nOriginal question: {question}"
)

async def decompose_and_retrieve(question: str) -> str:
    # Decompose
    sub_questions_raw: str = await (decompose_prompt | llm | StrOutputParser()).ainvoke({"question": question})
    sub_questions = [q.strip() for q in sub_questions_raw.strip().splitlines() if q.strip()]

    # Retrieve for each sub-question in parallel
    sub_docs_list: list[list[Document]] = await asyncio.gather(
        *[retriever.ainvoke(sq) for sq in sub_questions]
    )

    # Answer each sub-question
    sub_answers_parts = []
    for sq, docs in zip(sub_questions, sub_docs_list):
        context = "\n".join(d.page_content for d in docs)
        sub_prompt = ChatPromptTemplate.from_template(
            "Context: {context}\n\nSub-question: {sq}\n\nAnswer:"
        )
        ans = await (sub_prompt | llm | StrOutputParser()).ainvoke({"context": context, "sq": sq})
        sub_answers_parts.append(f"Q: {sq}\nA: {ans}")

    # Synthesise final answer
    sub_answers = "\n\n".join(sub_answers_parts)
    final = await (answer_prompt | llm | StrOutputParser()).ainvoke(
        {"sub_answers": sub_answers, "question": question}
    )
    return final

answer = asyncio.run(decompose_and_retrieve("How does task decomposition improve LLM performance and what are the main approaches?"))
print(answer)
```

---

## Adaptive RAG — Classifier Routing

A lightweight classifier routes queries by complexity: simple lookup queries skip
retrieval or use single-hop; complex questions use multi-hop or Self-RAG.

```python
from __future__ import annotations

from typing import Literal, TypedDict
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

class AdaptiveState(TypedDict):
    question: str
    documents: list[Document]
    answer: str
    route: str

class RouteDecision(BaseModel):
    route: Literal["no_retrieval", "single_hop", "multi_hop"] = Field(
        description="Route: no_retrieval (factual/greeting), single_hop (one doc needed), multi_hop (complex reasoning)"
    )

classifier_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).with_structured_output(RouteDecision)
llm = ChatOpenAI(model="gpt-4o", temperature=0)

store = QdrantVectorStore.from_existing_collection(
    url="http://localhost:6333",
    collection_name="rag_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
retriever_single = store.as_retriever(search_kwargs={"k": 3})
retriever_multi = store.as_retriever(search_kwargs={"k": 8})

def classify_node(state: AdaptiveState) -> AdaptiveState:
    classify_prompt = ChatPromptTemplate.from_template(
        "Classify this question:\n\n{question}\n\n"
        "- no_retrieval: simple factual, greeting, math\n"
        "- single_hop: requires one document\n"
        "- multi_hop: requires multiple documents or reasoning steps"
    )
    decision: RouteDecision = (classify_prompt | classifier_llm).invoke({"question": state["question"]})
    return {**state, "route": decision.route}

def no_retrieval_node(state: AdaptiveState) -> AdaptiveState:
    answer = llm.invoke(state["question"]).content
    return {**state, "answer": answer, "documents": []}

def single_hop_node(state: AdaptiveState) -> AdaptiveState:
    docs = retriever_single.invoke(state["question"])
    context = "\n\n".join(d.page_content for d in docs)
    gen_prompt = ChatPromptTemplate.from_template(
        "Answer based only on context.\n\nContext:\n{context}\n\nQuestion: {question}"
    )
    answer = (gen_prompt | llm).invoke({"context": context, "question": state["question"]}).content
    return {**state, "answer": answer, "documents": docs}

def multi_hop_node(state: AdaptiveState) -> AdaptiveState:
    docs = retriever_multi.invoke(state["question"])
    context = "\n\n".join(d.page_content for d in docs)
    gen_prompt = ChatPromptTemplate.from_template(
        "Reason through this step by step using only the context.\n\n"
        "Context:\n{context}\n\nQuestion: {question}"
    )
    answer = (gen_prompt | llm).invoke({"context": context, "question": state["question"]}).content
    return {**state, "answer": answer, "documents": docs}

def route_edge(state: AdaptiveState) -> Literal["no_retrieval", "single_hop", "multi_hop"]:
    return state["route"]

workflow = StateGraph(AdaptiveState)
workflow.add_node("classify", classify_node)
workflow.add_node("no_retrieval", no_retrieval_node)
workflow.add_node("single_hop", single_hop_node)
workflow.add_node("multi_hop", multi_hop_node)

workflow.set_entry_point("classify")
workflow.add_conditional_edges(
    "classify",
    route_edge,
    {"no_retrieval": "no_retrieval", "single_hop": "single_hop", "multi_hop": "multi_hop"},
)
workflow.add_edge("no_retrieval", END)
workflow.add_edge("single_hop", END)
workflow.add_edge("multi_hop", END)

adaptive_graph = workflow.compile()

for question in [
    "What is 2 + 2?",
    "What is task decomposition?",
    "How does task decomposition relate to chain-of-thought and what are the implementation tradeoffs?",
]:
    result = adaptive_graph.invoke({"question": question, "documents": [], "answer": "", "route": ""})
    print(f"[{result['route']}] {question}\n→ {result['answer'][:100]}...\n")
```

---

## Production Gotchas

| Gotcha | Detail |
|---|---|
| LCEL dict step is parallel | `{"context": retriever | format_docs, "question": RunnablePassthrough()}` — retriever and passthrough run in parallel. Retrieval does not block on question setup. |
| LangGraph: always pass all state keys | Nodes should return a complete state dict, not just the changed keys, unless using `operator.add` reducers. Missing keys raise `KeyError`. |
| Self-RAG: `MAX_RETRIES` guard required | Without a retry limit, grading failures can loop indefinitely. Always guard with `retry_count >= MAX_RETRIES`. |
| HyDE: hypothetical bias | The generated hypothetical answer encodes the LLM's prior beliefs. If the LLM is wrong about the domain, retrieval steers toward wrong documents. Measure A/B vs plain similarity. |
| CRAG: web search adds latency and cost | Each fallback to web search adds ~1–3 s and API cost. Reserve for queries where knowledge-base gaps cause measurable hallucination. |
| Adaptive routing adds one LLM call | The classifier call adds ~100–300 ms. Justify against savings from skipping retrieval on easy queries. |
| `create_react_agent` tool schema | The `@tool` docstring becomes the tool description sent to the LLM. Write it precisely — vague descriptions cause incorrect tool selection. |
