# Migration Reference — Deprecated → Current API, Community Import Renames

## Overview

LangChain 1.0 (GA October 2025) moved all legacy patterns to `langchain-classic` and
partner packages. This reference covers every deprecated API with code for both the old
and new sides, so migrations can be validated before removing the old code.

---

## Chains and Agents Migration

### LLMChain → LCEL

| Old | New |
|---|---|
| `from langchain.chains import LLMChain` | `prompt \| llm \| StrOutputParser()` |
| `from langchain_classic.chains import LLMChain` | Transitional; still works |

```python
# OLD — LLMChain
from langchain_classic.chains import LLMChain
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = PromptTemplate.from_template("Tell me a joke about {topic}.")
chain = LLMChain(llm=llm, prompt=prompt)
result = chain.invoke({"topic": "Python"})
output = result["text"]

# NEW — LCEL
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("Tell me a joke about {topic}.")
chain = prompt | model | StrOutputParser()
output: str = chain.invoke({"topic": "Python"})
```

### RetrievalQA → LCEL RAG

| Old | New |
|---|---|
| `from langchain.chains import RetrievalQA` | LCEL RAG pipeline |
| `from langchain_classic.chains import RetrievalQA` | Transitional |

```python
# OLD — RetrievalQA
from langchain_classic.chains import RetrievalQA
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
)
result = qa_chain.invoke({"query": "What is LangChain?"})
output = result["result"]

# NEW — LCEL RAG
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model


def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)


model = init_chat_model("openai:gpt-4o-mini")
prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer using the following context:\n\n{context}"),
    ("human", "{question}"),
])

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)
output: str = rag_chain.invoke("What is LangChain?")
```

### ConversationalRetrievalChain → LCEL + LangGraph

```python
# OLD — ConversationalRetrievalChain
from langchain_classic.chains import ConversationalRetrievalChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,
)
result = chain.invoke({"question": "What is LCEL?", "chat_history": []})

# NEW — LCEL with history-aware retrieval, memory via LangGraph checkpointer
# (See LangGraph skill for full memory/checkpointer setup)
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

# Step 1: condense question using history
condense_prompt = ChatPromptTemplate.from_messages([
    MessagesPlaceholder("history"),
    ("human", "{question}"),
    ("human", "Given the above conversation, rephrase the question as a standalone question."),
])
condense_chain = condense_prompt | model | StrOutputParser()

# Step 2: RAG with condensed question
rag_prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer using context:\n\n{context}"),
    ("human", "{question}"),
])

def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | rag_prompt
    | model
    | StrOutputParser()
)

# Full conversation chain
def conversational_rag(question: str, history: list) -> str:
    if history:
        standalone = condense_chain.invoke({"question": question, "history": history})
    else:
        standalone = question
    return rag_chain.invoke(standalone)
```

### AgentExecutor / create_react_agent → create_agent

| Old | New |
|---|---|
| `from langchain.agents import AgentExecutor` | `from langchain.agents import create_agent` |
| `from langchain.agents import create_react_agent` | `from langchain.agents import create_agent` |
| `from langgraph.prebuilt import create_react_agent` | `from langchain.agents import create_agent` |

```python
# OLD — AgentExecutor
from langchain_classic.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])
agent = create_react_agent(llm=llm, tools=[search], prompt=prompt)
agent_executor = AgentExecutor(agent=agent, tools=[search], verbose=True)
result = agent_executor.invoke({"input": "What is the weather in Paris?"})
output = result["output"]

# NEW — create_agent (v1 standard entrypoint)
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool


@tool
def search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"


model = init_chat_model("openai:gpt-4o-mini")
agent = create_agent(model=model, tools=[search])
result = agent.invoke({"messages": [{"role": "human", "content": "Weather in Paris?"}]})
```

### ConversationBufferMemory → LangGraph Checkpointer

| Old | New |
|---|---|
| `from langchain.memory import ConversationBufferMemory` | LangGraph checkpointer |
| `from langchain_classic.memory import ConversationBufferMemory` | Transitional |

```python
# OLD — ConversationBufferMemory
from langchain_classic.memory import ConversationBufferMemory
from langchain_classic.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
memory = ConversationBufferMemory()
conversation = ConversationChain(llm=llm, memory=memory, verbose=True)
conversation.predict(input="Hi, I'm Alice.")
conversation.predict(input="What's my name?")

# NEW — LangGraph MemorySaver (see LangGraph skill for full setup)
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import MemorySaver

model = init_chat_model("openai:gpt-4o-mini")
memory = MemorySaver()
agent = create_agent(model=model, tools=[], checkpointer=memory)

config = {"configurable": {"thread_id": "session-alice"}}
agent.invoke({"messages": [{"role": "human", "content": "Hi, I'm Alice."}]}, config=config)
agent.invoke({"messages": [{"role": "human", "content": "What's my name?"}]}, config=config)
# History is persisted in MemorySaver keyed by thread_id
```

---

## hub.pull Migration

| Old | New |
|---|---|
| `from langchain import hub; hub.pull("name")` | `from langsmith import Client; Client().pull_prompt("name")` |
| `from langchain_classic import hub; hub.pull("name:tag")` | `Client().pull_prompt("name:tag")` |

```python
# OLD — hub.pull
from langchain_classic import hub

prompt = hub.pull("langchain-ai/retrieval-qa-chat")
versioned = hub.pull("joke-generator:a1b2c3d4")

# NEW — LangSmith Client
from langsmith import Client

client = Client()   # LANGSMITH_API_KEY from env
prompt = client.pull_prompt("langchain-ai/retrieval-qa-chat")
versioned = client.pull_prompt("joke-generator:a1b2c3d4")
tagged = client.pull_prompt("joke-generator:production")

# Push
client.push_prompt("my-org/my-prompt", object=prompt)
```

---

## Community Imports → Partner Packages

The table below covers every import that changed. Items marked "stays" remain in
`langchain-community`. Also note class renames.

### Chat models

| OLD | NEW | Notes |
|---|---|---|
| `langchain_community.chat_models.ChatOpenAI` | `langchain_openai.ChatOpenAI` | |
| `langchain_community.chat_models.AzureChatOpenAI` | `langchain_openai.AzureChatOpenAI` | |
| `langchain_community.chat_models.ChatAnthropic` | `langchain_anthropic.ChatAnthropic` | |
| `langchain_community.chat_models.ChatGooglePalm` | `langchain_google_genai.ChatGoogleGenerativeAI` | Renamed |
| `langchain_community.chat_models.ChatOllama` | `langchain_ollama.ChatOllama` | |

```python
# OLD
from langchain_community.chat_models import ChatOpenAI, ChatAnthropic
llm = ChatOpenAI(model="gpt-4o-mini")

# NEW
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
llm = ChatOpenAI(model="gpt-4o-mini")

# PREFERRED (v1) — init_chat_model
from langchain.chat_models import init_chat_model
llm = init_chat_model("openai:gpt-4o-mini")
```

### Embeddings

| OLD | NEW | Notes |
|---|---|---|
| `langchain_community.embeddings.OpenAIEmbeddings` | `langchain_openai.OpenAIEmbeddings` | |
| `langchain_community.embeddings.AzureOpenAIEmbeddings` | `langchain_openai.AzureOpenAIEmbeddings` | |
| `langchain_community.embeddings.HuggingFaceEmbeddings` | `langchain_huggingface.HuggingFaceEmbeddings` | |
| `langchain_community.embeddings.OllamaEmbeddings` | `langchain_ollama.OllamaEmbeddings` | |
| `langchain_community.embeddings.GooglePalmEmbeddings` | `langchain_google_genai.GoogleGenerativeAIEmbeddings` | Renamed |
| `langchain_community.embeddings.VertexAIEmbeddings` | `langchain_google_vertexai.VertexAIEmbeddings` | |

```python
# OLD
from langchain_community.embeddings import OpenAIEmbeddings, HuggingFaceEmbeddings

# NEW
from langchain_openai import OpenAIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
```

### LLMs (non-chat)

| OLD | NEW | Notes |
|---|---|---|
| `langchain_community.llms.Ollama` | `langchain_ollama.OllamaLLM` | **Renamed** to `OllamaLLM` |
| `langchain_community.llms.OpenAI` | `langchain_openai.OpenAI` | |

```python
# OLD
from langchain_community.llms import Ollama
llm = Ollama(model="llama3")

# NEW — note: class renamed
from langchain_ollama import OllamaLLM
llm = OllamaLLM(model="llama3")
```

### Vector stores

| OLD | NEW | Class rename? |
|---|---|---|
| `langchain_community.vectorstores.Chroma` | `langchain_chroma.Chroma` | No |
| `langchain_community.vectorstores.Pinecone` | `langchain_pinecone.PineconeVectorStore` | **Yes** → `PineconeVectorStore` |
| `langchain_community.vectorstores.Qdrant` | `langchain_qdrant.QdrantVectorStore` | **Yes** → `QdrantVectorStore` |
| `langchain_community.vectorstores.Weaviate` | `langchain_weaviate.WeaviateVectorStore` | **Yes** → `WeaviateVectorStore` |
| `langchain_community.vectorstores.Milvus` | `langchain_milvus.Milvus` | No |
| `langchain_community.vectorstores.MongoDBAtlasVectorSearch` | `langchain_mongodb.MongoDBAtlasVectorSearch` | No |
| `langchain_community.vectorstores.Redis` | `langchain_redis.RedisVectorStore` | **Yes** → `RedisVectorStore` |
| `langchain_community.vectorstores.FAISS` | **stays** in `langchain_community` | No (`faiss-cpu`/`faiss-gpu` required) |

```python
# OLD — Pinecone
from langchain_community.vectorstores import Pinecone
vs = Pinecone(index=index, embedding=embeddings, text_key="text")

# NEW — renamed class, different constructor
from langchain_pinecone import PineconeVectorStore
vs = PineconeVectorStore(index=index, embedding=embeddings, text_key="text")

# OLD — Qdrant
from langchain_community.vectorstores import Qdrant

# NEW
from langchain_qdrant import QdrantVectorStore

# FAISS — stays in community
from langchain_community.vectorstores import FAISS   # unchanged
```

### Retrievers

| OLD | NEW | Notes |
|---|---|---|
| `langchain_community.retrievers.BM25Retriever` | **stays** in `langchain_community` | needs `rank_bm25` |
| `langchain.retrievers.EnsembleRetriever` | `langchain_classic.retrievers.EnsembleRetriever` | Moved to classic |
| `langchain.retrievers.MultiQueryRetriever` | `langchain_classic.retrievers.MultiQueryRetriever` | Moved to classic |
| `langchain.retrievers.ContextualCompressionRetriever` | `langchain_classic.retrievers.ContextualCompressionRetriever` | Moved to classic |
| `langchain.retrievers.ParentDocumentRetriever` | `langchain_classic.retrievers.ParentDocumentRetriever` | Moved to classic |
| `langchain.retrievers.SelfQueryRetriever` | `langchain_classic.retrievers.SelfQueryRetriever` | Moved to classic |

### Storage and caching

| OLD | NEW | Notes |
|---|---|---|
| `langchain.storage.InMemoryStore` | `langchain_core.stores.InMemoryByteStore` | Moved to core |
| `langchain.embeddings.CacheBackedEmbeddings` | `langchain_classic.embeddings.CacheBackedEmbeddings` | Moved to classic |
| `langchain.storage.LocalFileStore` | `langchain_classic.storage.LocalFileStore` | Moved to classic |

---

## Google Provider Consolidation

> **⚠️ `langchain-google-vertexai` ≥ 3.2.0:** Some classes deprecated in favour of
> `langchain-google-genai ≥ 4.0.0` which uses the consolidated `google-genai` SDK.

| OLD | NEW | Package |
|---|---|---|
| `langchain_google_vertexai.ChatVertexAI` (for Gemini) | `langchain_google_genai.ChatGoogleGenerativeAI` | `langchain-google-genai>=4.0.0` |
| `langchain_google_vertexai.VertexAIEmbeddings` (for Gemini) | `langchain_google_genai.GoogleGenerativeAIEmbeddings` | `langchain-google-genai>=4.0.0` |
| `langchain_community.chat_models.ChatGooglePalm` | `langchain_google_genai.ChatGoogleGenerativeAI` | Renamed |

```python
# OLD — via VertexAI (for Gemini API)
from langchain_google_vertexai import ChatVertexAI
model = ChatVertexAI(model="gemini-2.0-flash")

# NEW — consolidated google-genai SDK
from langchain_google_genai import ChatGoogleGenerativeAI
model = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

# Or via init_chat_model
from langchain.chat_models import init_chat_model
model = init_chat_model("google_genai:gemini-2.0-flash")
```

---

## AIMessage API Changes

| OLD | NEW | Notes |
|---|---|---|
| `msg.text()` (method call) | `msg.text` (property) | `.text()` emits `DeprecationWarning`; removed in v2 |
| `AIMessage(..., example=True)` | — | `example` parameter removed in v1 |
| `msg.additional_kwargs["function_call"]` | `msg.tool_calls` (list of `ToolCall`) | Legacy OpenAI functions path; migrate to `.tool_calls` |
| Return type `BaseMessage` from `invoke` | `AIMessage` | v1 tightened; update custom model signatures |

```python
# OLD — .text() method
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o-mini")
resp = model.invoke("Hello")
text = resp.text()   # DeprecationWarning

# NEW — .text property
text = resp.text   # or resp.content for the raw string

# OLD — reading tool calls from additional_kwargs
tool_name = resp.additional_kwargs.get("function_call", {}).get("name")

# NEW — standardised tool_calls
for tc in resp.tool_calls:
    print(tc["name"], tc["args"], tc["id"])
```

---

## Package Installation Reference

```bash
# Core + agent layer
uv add langchain-core langchain

# Transitional bridge for legacy code
uv add langchain-classic

# Partner packages (add only what you use)
uv add langchain-openai
uv add langchain-anthropic
uv add langchain-google-genai          # Gemini via google-genai SDK
uv add langchain-google-vertexai       # Vertex AI
uv add langchain-aws                   # Bedrock
uv add langchain-ollama
uv add langchain-groq
uv add langchain-mistralai
uv add langchain-cohere
uv add langchain-huggingface

# Vector store packages
uv add langchain-chroma
uv add langchain-pinecone
uv add langchain-qdrant
uv add langchain-milvus
uv add langchain-mongodb
uv add langchain-redis
uv add "langchain-community[faiss-cpu]"   # FAISS stays in community

# Text splitting
uv add langchain-text-splitters

# Experimental (SemanticChunker etc.)
uv add langchain-experimental

# LangSmith tracing
uv add langsmith
```

> **Rule:** Never use `pip install` — use `uv add` exclusively.

---

## Migration Priority Order

Execute migrations in this sequence to minimise breakage:

| Step | Action | Impact |
|---|---|---|
| 1 | Repoint `langchain_community` chat/embedding imports to partner packages | Stops deprecation warnings; no behaviour change |
| 2 | Repoint vector store imports to partner packages; fix class renames | Same |
| 3 | Move legacy chain/retriever/hub imports to `langchain-classic` equivalents | Stabilises against future `langchain` package changes |
| 4 | Rewrite `LLMChain` → LCEL pipe | Removes classic dependency for simple chains |
| 5 | Rewrite `RetrievalQA` / `ConversationalRetrievalChain` → LCEL RAG | Removes classic dependency for RAG |
| 6 | Replace `ConversationBufferMemory` with LangGraph checkpointer | Unlocks persistent, multi-session memory |
| 7 | Replace `AgentExecutor` / `create_react_agent` with `create_agent` | Access to v1 agent features (structured response, etc.) |
| 8 | Replace `hub.pull` with `Client().pull_prompt` | Removes classic dependency; more control over prompt versions |

**Thresholds to revisit approach:**
- If `ProviderStrategy` raises `400 Schema is too complex for grammar compilation` → flatten schema or switch to `ToolStrategy`
- If a community import emits a deprecation warning → migrate immediately; community integrations may be deprecated at any time
- If any classic import emits `LangChainDeprecationWarning` → that item has a clear migration path; follow it
