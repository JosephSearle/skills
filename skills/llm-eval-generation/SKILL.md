---
name: llm-eval-generation
description: >
  Generate evaluation tests for LLM-integrated code: RAG pipelines, agents, tool-calling systems,
  structured output extractors, chatbots, code generators, and summarization pipelines. Detects
  LLM framework imports to confirm scope, classifies the application scenario, identifies existing
  eval tooling, and writes idiomatic eval tests to disk. Triggers on: "write evals for", "add
  evaluation tests", "test my LLM pipeline", "evaluate my agent", "add eval coverage", "generate
  evals for my RAG", "write LLM-as-judge tests", or any instruction to evaluate, test, or measure
  the quality of LLM-integrated code.
---

# LLM Eval Generation Skill

A skill for generating evaluation tests for LLM-integrated code — grounded in ISO/IEC 42001,
NIST AI RMF, HELM evaluation dimensions, and the OpenAI Skill Eval Framework. Covers RAG
pipelines, agents, tool-calling systems, structured output, chatbots, code generation, and
summarization across Python, TypeScript, and Go.

This skill generates **evaluation tests**, not unit tests. The distinction matters: unit tests
verify deterministic logic with exact assertions; eval tests measure the quality of non-deterministic
LLM outputs using metrics, rubrics, and LLM-as-judge scoring. For deterministic logic in
LLM-integrated code, use the `test-generation` skill alongside this one.

---

## Core Philosophy

LLM output cannot be tested with `assert output == expected`. Eval tests answer a different
question: **does this output meet defined quality criteria, reliably, across a representative
range of inputs?**

Every generated eval must define: what criteria matter, how they are measured, what threshold
constitutes passing, and how many trials are needed to trust the result. A single-trial pass on
a stochastic system is not a meaningful result.

---

## Step 1 — Trigger Verification

Before anything else, confirm the file under test contains LLM-integrated code. If not, stop
and redirect to `test-generation`.

**Python — triggers this skill:**
```
anthropic, openai, google.generativeai, boto3 (with bedrock client)
langchain*, langgraph, llama_index, llama_cpp, dspy
crewai, autogen, pyautogen, semantic_kernel, haystack, pydantic_ai
```

**Python — existing eval setup (also triggers):**
```
deepeval, ragas, trulens, promptfoo, braintrust, langfuse, langsmith
```

**TypeScript — triggers this skill:**
```
@anthropic-ai/sdk, openai, @google/generativeai
@langchain/*, langchain, @langsmith/*
ai (Vercel AI SDK), @mastra/core, @google/adk
```

**Go — triggers this skill:**
```
github.com/anthropics/anthropic-sdk-go
github.com/sashabaranov/go-openai
```

```
LLM-related imports detected?
  └─ NO  → Stop. Note: this skill is for LLM-integrated code.
           Redirect to test-generation for deterministic logic.
  └─ YES → Proceed to Step 2.
```

---

## Step 2 — Scenario Classification

Read the source file(s) and identify which scenario(s) apply. Multiple scenarios can apply to a
single file. Each detected scenario loads its own reference file in Step 4.

| Scenario | Code signals |
|---|---|
| RAG | `similarity_search`, `retrieve`, `VectorStore`, embedding operations, document loading, retriever objects, `as_retriever()` |
| Agent / tool-use | `@tool`, `bind_tools`, `ToolCall`, `function_call`, `AgentExecutor`, tool schemas, tool-calling loops, `.invoke()` with tool definitions |
| Structured output | Pydantic model as output type, `.with_structured_output()`, `response_format=`, JSON schema in return type |
| Safety-critical | User-provided content processed by agent, external tool outputs fed back into an agent loop, any agentic loop handling untrusted input |
| Summarization | `summarize`, `MapReduceDocumentsChain`, document chunking for compression, explicit summarization prompts |
| Question answering | Direct query → answer without retrieval, `qa_chain`, fact-based response patterns, knowledge-grounded Q&A |
| Conversational | `ChatHistory`, `MessagesPlaceholder`, session/memory management, multi-turn conversation state |
| Code generation | Returns code strings, `exec()`, code-block extraction, language detection in output |

**Safety-critical is additive** — load `references/scenarios/safety-adversarial.md` alongside
any other scenario when the code handles untrusted input or operates in an agentic loop.

If the scenario is genuinely ambiguous after reading the code, ask the user to clarify.

---

## Step 3 — Framework Detection

Check existing dependencies for eval framework presence before recommending one.

**Where to look:**

| Language | Files |
|---|---|
| Python | `pyproject.toml`, `requirements.txt`, `requirements-dev.txt` |
| TypeScript | `package.json` devDependencies |
| Go | `go.mod` |

```
Existing CI/CD eval framework found?
  └─ deepeval         → load references/frameworks/deepeval.md
  └─ ragas            → load references/frameworks/ragas.md
  └─ promptfoo        → load references/frameworks/promptfoo.md
  └─ None detected    → recommend based on scenario:
       RAG detected              → RAGAS + DeepEval for CI gating
       Agent / tool-use          → DeepEval (DAG metric)
       Safety detected           → Promptfoo (mandatory for red-team) + DeepEval
       Structured output         → DeepEval
       All other scenarios       → DeepEval (broadest coverage, pytest-native default)

Existing observability platform found?
  └─ langfuse / langsmith / braintrust / arize-phoenix / wandb
       → load references/frameworks/observability.md (for integration patterns)
  └─ None detected    → recommend based on stack:
       LangChain / LangGraph heavy → LangSmith
       Otherwise                   → Langfuse (open-source, no per-seat pricing)
       Always load references/frameworks/observability.md to explain the choice
```

---

## Step 4 — Load References

```
Always load:
  references/universal.md

For each scenario detected in Step 2:
  RAG                  → references/scenarios/rag.md
  Agent / tool-use     → references/scenarios/agent-tool-use.md
  Structured output    → references/scenarios/structured-output.md
  Safety-critical      → references/scenarios/safety-adversarial.md
  Summarization        → references/scenarios/summarization.md
  Question answering   → references/scenarios/question-answering.md
  Conversational       → references/scenarios/conversational.md
  Code generation      → references/scenarios/code-generation.md

For the framework(s) identified in Step 3:
  DeepEval             → references/frameworks/deepeval.md
  RAGAS                → references/frameworks/ragas.md
  Promptfoo            → references/frameworks/promptfoo.md
  Any observability    → references/frameworks/observability.md
```

---

## Step 5 — Generate Eval Tests

Apply `references/universal.md` to all evals. Then apply the scenario and framework references.

### Universal requirements (apply regardless of scenario or framework)

**Dataset size and composition:**
- Minimum 10–20 eval cases per scenario — sufficient to surface regressions early
- Mix required: happy path, edge cases, adversarial inputs, abstention/refusal cases (negative
  examples must be included — cases where the correct answer is to decline or escalate)
- Source priority: production failures first, real user queries second, synthetic with human
  review third. Do not build eval sets from synthetic data alone.

**Multi-trial for stochastic components:**
- Every eval case must run ≥ 3 trials; report pass@k, not single-trial pass/fail
- A single-trial pass on a non-deterministic system is not a meaningful eval result
- Budget multi-trial runs in CI — flag this explicitly in run guidance

**LLM-as-judge requirements:**
- Every rubric must define criteria explicitly — vague criteria produce noisy scores
- Require Chain-of-Thought reasoning before the score (G-Eval pattern)
- Output must be structured: `{"score": N, "rationale": "..."}`
- Use a different, more capable model as judge than the model being evaluated
- Validate judge against human labels before relying on it in CI

**CI threshold defaults** (override if project configures its own):
- Faithfulness: ≥ 0.8
- Answer relevance: ≥ 0.7
- Context precision: ≥ 0.7
- Custom G-Eval metrics: ≥ 7/10

### File placement

| Framework | File location |
|---|---|
| DeepEval | `evals/eval_<module>.py` |
| RAGAS | `evals/eval_<module>_rag.py` |
| Promptfoo | `evals/<module>.promptfoo.yaml` |
| Golden datasets | `evals/datasets/<module>_golden.json` |

Version eval datasets alongside code — treat `evals/datasets/` like source code.

---

## Step 6 — Write to Disk & Run Guidance

Write generated eval files to the locations in Step 5. If eval files already exist for this
module, extend them — do not overwrite.

### Run commands

**DeepEval:**
```bash
# Run all evals
deepeval test run evals/eval_<module>.py

# With verbose metric output
deepeval test run evals/ --verbose

# CI gate — fail if any metric drops below threshold
deepeval test run evals/ --fail-on-metric-below 0.8
```

**RAGAS:**
```bash
python evals/eval_<module>_rag.py
```

**Promptfoo:**
```bash
# Quality eval
promptfoo eval --config evals/<module>.promptfoo.yaml

# Red-team adversarial sweep
promptfoo redteam eval --config evals/<module>.promptfoo.yaml
```

**Multi-trial (all frameworks):**
Note explicitly: eval results are only meaningful with ≥ 3 trials per case. Set the trial count
in the framework config — do not run once and report the result.

---

## Reference Files

- `references/universal.md` — ISO 42001, NIST AI RMF + AI 600-1, EU AI Act risk tiers,
  HELM 7 evaluation dimensions, core metric taxonomy, evaluation methodologies, LLM-as-judge
  standards and failure modes, CI/CD eval pipeline architecture, eval dataset design standards
- `references/scenarios/rag.md` — RAGAS triad metrics, retriever vs generator evaluation,
  CI thresholds, recommended stack
- `references/scenarios/agent-tool-use.md` — Tool selection accuracy, parameter F1, sequence
  accuracy, pass@k reliability, DeepEval DAG metric, Arize Phoenix agent evaluators
- `references/scenarios/structured-output.md` — Schema validation, field accuracy, extraction
  faithfulness, format consistency
- `references/scenarios/safety-adversarial.md` — Prompt injection, red-team vectors, PII
  leakage, scope containment, toxicity, SKILL-INJECT benchmark
- `references/scenarios/summarization.md` — Faithfulness, coverage, conciseness, coherence,
  G-Eval patterns, domain-critical golden datasets
- `references/scenarios/question-answering.md` — Exact Match, F1, answer correctness,
  calibration (ECE), TruthfulQA alignment
- `references/scenarios/conversational.md` — Session-level evaluation, topic adherence,
  response consistency, escalation accuracy, user feedback integration
- `references/scenarios/code-generation.md` — pass@k, execution sandbox, security scan,
  sandboxed container patterns
- `references/frameworks/deepeval.md` — Pytest-native CI/CD default; G-Eval, DAG metric,
  FaithfulnessMetric, AnswerRelevancyMetric; patterns across all scenarios
- `references/frameworks/ragas.md` — RAG-specific; reference-free evaluation; LangChain and
  LlamaIndex integration; synthetic test-set generation
- `references/frameworks/promptfoo.md` — Adversarial + red-team; YAML config patterns;
  500+ attack vectors; multi-provider comparison; CI GitHub Action
- `references/frameworks/observability.md` — Langfuse, LangSmith, Braintrust, Arize Phoenix,
  W&B Weave; CI gate vs trace storage distinction; decision matrix
