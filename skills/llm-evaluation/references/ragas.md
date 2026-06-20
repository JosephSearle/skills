# RAGAS Reference

**Version**: ≥ 0.4.3 (v0.4 introduced breaking API changes — legacy API deprecated, removed in 1.0)

## v0.4 API — evaluate()

```python
from ragas import evaluate
from ragas.metrics import (
    context_precision,
    context_recall,
    faithfulness,
    answer_relevancy,
    answer_correctness,
)
from ragas.llms import LangchainLLMWrapper
from langchain_anthropic import ChatAnthropic
from datasets import Dataset

# Always configure an explicit judge LLM — default calls OpenAI
judge_llm = LangchainLLMWrapper(ChatAnthropic(model="claude-haiku-4-5-20251001"))

dataset = Dataset.from_list([
    {
        "question": "What is LangGraph?",
        "answer": "LangGraph is a framework for building stateful agent applications.",
        "contexts": ["LangGraph 1.x is a Pregel-based graph execution engine..."],
        "ground_truth": "LangGraph is a library for building stateful, multi-actor applications.",
    },
])

result = evaluate(
    dataset,
    metrics=[context_precision, faithfulness, answer_relevancy],
    llm=judge_llm,
)

# v0.4: result returns metric objects, not floats — use .scores attribute
print(result.scores)       # list of dicts, one per row
print(result.to_pandas())  # pd.DataFrame for analysis
```

## Metrics reference

| Metric | Required dataset fields | What it measures |
|---|---|---|
| `context_precision` | `question`, `contexts`, `ground_truth` | Are retrieved chunks relevant? (precision of retrieval) |
| `context_recall` | `question`, `contexts`, `ground_truth` | Did we retrieve enough relevant chunks? |
| `faithfulness` | `question`, `answer`, `contexts` | Is the answer grounded in the retrieved context? |
| `answer_relevancy` | `question`, `answer` | Does the answer address the question? |
| `answer_correctness` | `question`, `answer`, `ground_truth` | Is the answer factually correct vs ground truth? |

## Dataset fields mapping

```python
{
    "question": str,          # the user's question
    "answer": str,            # the agent's generated answer
    "contexts": list[str],    # retrieved chunks (NOT the full documents — just the chunks fed to LLM)
    "ground_truth": str,      # optional: human-verified correct answer
}
```

`contexts` must be the chunks that were **actually fed to the LLM**, not all available documents.
This is why the agent contract must expose `retrieval_context` separately.

## TestsetGenerator — synthetic dataset creation

```python
from ragas.testset import TestsetGenerator
from langchain_anthropic import ChatAnthropic
from langchain_community.document_loaders import DirectoryLoader

loader = DirectoryLoader("./docs", glob="**/*.md")
documents = loader.load()

generator = TestsetGenerator.from_langchain(
    generator_llm=ChatAnthropic(model="claude-sonnet-4-6"),
    critic_llm=ChatAnthropic(model="claude-haiku-4-5-20251001"),
    embeddings=your_embeddings,
)

testset = generator.generate_with_langchain_docs(
    documents,
    test_size=50,
    distributions={
        "simple": 0.5,      # straightforward factual questions
        "reasoning": 0.3,   # multi-hop reasoning questions
        "multi_context": 0.2,  # questions needing multiple chunks
    },
)

# Export as HuggingFace Dataset or pandas DataFrame
df = testset.to_pandas()
df.to_json("datasets/generated_rag.json", orient="records")
```

Rebuild generated datasets from production documents periodically — synthetic datasets drift from
real user behaviour over time. Generate a fresh dataset before each major release.

## NaN score guards

NaN scores occur when the judge LLM returns invalid JSON. Mitigations:
- Pin a reliable judge model (`claude-haiku-4-5-20251001` is stable for structured output).
- Add assertion guards after evaluation:

```python
result_df = result.to_pandas()
nan_rows = result_df[result_df.isnull().any(axis=1)]
if not nan_rows.empty:
    print(f"Warning: {len(nan_rows)} rows have NaN scores — judge JSON parse failures")
    result_df = result_df.dropna()   # exclude from aggregate metrics
```

## Via MLflow scorers (preferred in CI)

```python
from mlflow.genai.scorers import ragas

# RAGAS metrics as MLflow scorers — logs to MLflow experiment automatically
results = mlflow.genai.evaluate(
    data=eval_data,
    predict_fn=your_agent,
    scorers=[
        ragas.context_precision(),
        ragas.context_recall(),
        ragas.faithfulness(),
        ragas.answer_relevancy(),
    ],
)
```

## v0.4 migration gotchas

- `LangchainLLMWrapper` signature changed in some v0.4 code paths — check the 0.4 migration guide.
- `result.scores` (list of dicts) replaced the old direct metric float attributes.
- `answer_correctness` now requires `ground_truth` — it will silently skip rows without it.
