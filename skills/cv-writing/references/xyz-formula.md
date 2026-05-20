# XYZ Bullet Formula

## The Formula

> *"Accomplished [X], as measured by [Y], by doing [Z]."*

Source: Laszlo Bock, *Work Rules!* (Twelve/Hachette, 2015). Bock was Senior
Vice President of People Operations at Google.

This is the gold standard for engineering CV bullets because it forces:
- **X** — a concrete outcome or deliverable
- **Y** — a measurable signal that the outcome was achieved
- **Z** — the specific action or approach taken

**Target:** 70% of bullets should hit all three elements. The remaining 30% may
use two elements (X + Z) when a metric is genuinely unavailable.

---

## Quantification Ladder

When you don't have a percentage, work down this ladder until you find a metric
that is honest and defensible:

1. **Percentage change** — "reduced latency by 38%", "cut deploy time by 87%"
2. **Absolute counts** — "handling 1.2M tasks/month", "12M requests/month", "14 agents in production"
3. **Money** — "reduced LLM spend by £40k/quarter", "ARR influenced: £2M"
4. **Time** — "cut integration time from 3 weeks to 4 days", "p95 latency under 4s"
5. **Scale** — "serving 50k daily active users", "indexed 8TB of enterprise documents"

Every bullet should hit at least one rung of this ladder.

---

## Action Verbs for AI Engineers

Lead every bullet with one of these — never with "responsible for", "helped with",
"worked on", or "assisted".

**Shipping & ownership:**
architected, shipped, productionised, deployed, launched, delivered, owned, led, drove

**Building & designing:**
designed, built, engineered, implemented, developed, constructed, authored, created

**Improving & optimising:**
optimised, reduced, accelerated, improved, streamlined, refactored, migrated, upgraded

**AI-specific:**
fine-tuned, evaluated, instrumented, benchmarked, orchestrated, distilled, quantised,
prompted, curated, red-teamed, hardened

**Operating & scaling:**
scaled, operated, maintained, monitored, automated, managed, governed

**Enabling others:**
standardised, documented, mentored, onboarded, open-sourced

---

## Bullet Length Rules

- **Maximum**: 2 lines (as rendered in a standard Word document at 11pt)
- **Most recent role**: 3–5 bullets
- **Role 2 (1–3 years prior)**: 2–3 bullets
- **Older roles**: 1–2 bullets or omit entirely for a mid-level engineer
- Do not use sub-bullets or nested lists within a role

---

## Anti-Patterns

| Weak | Strong |
|------|--------|
| Responsible for maintaining the RAG pipeline | Maintained and scaled a Milvus RAG pipeline processing 4M queries/day |
| Helped with LangGraph agent development | Shipped 3 production LangGraph agents handling document analysis for 800 enterprise users |
| Worked on LLM cost reduction | Reduced LLM inference spend by 27% in Q3 by implementing prompt caching and model routing |
| Contributed to the CI/CD pipeline | Owned CI/CD for 14 LangGraph agents on OpenShift using Tekton and ArgoCD |
| Assisted in fine-tuning the model | Fine-tuned a Llama 3.1 8B model with LoRA (Axolotl), lifting ROUGE-L from 0.52 to 0.71 |

---

## Worked Exemplars (AI/ML / Agentic Stack)

These are few-shot examples for the target profile (mid-level, UK, agentic AI scale-up).
Use as inspiration — always replace placeholder numbers with the candidate's real data.

**MCP / tool servers:**
> Designed and shipped 7 production MCP servers exposing internal data sources to
> Claude-based agents, reducing tool-integration time for new use cases from 3 weeks to 4 days.

**LangGraph orchestration:**
> Architected a LangGraph supervisor-agent system orchestrating 5 specialist sub-agents
> on OpenShift, handling 1.2M tasks/month with p95 latency under 4s.

**RAG pipeline:**
> Built a Milvus-backed RAG pipeline with hybrid BM25 + dense retrieval and
> bge-reranker re-ranking, lifting answer-relevance evals (Ragas) from 0.62 to 0.81.

**Fine-tuning pipeline:**
> Implemented a continuous fine-tuning pipeline (LoRA, Axolotl, TRL) triggered by
> LangFuse-tagged failure traces, shipping a new adapter weekly with automated
> regression evals.

**CI/CD for agents:**
> Owned CI/CD for 14 LangGraph agents on OpenShift using Tekton and ArgoCD, cutting
> deploy time from 45 minutes to 6 and adding canary rollouts gated by eval-suite pass rate.

**LLM observability / cost:**
> Instrumented every agent run with LangFuse and OpenTelemetry GenAI semantic
> conventions, enabling cost attribution that reduced LLM spend by 27% in one quarter.

**Retrieval latency:**
> Reduced p95 RAG retrieval latency by 38% (from 820ms to 510ms) by redesigning the
> Milvus collection schema and introducing HNSW index parameter tuning.

**Evals framework:**
> Built a golden-dataset eval suite (DeepEval + LLM-as-judge) covering 400 test cases,
> enabling weekly regression tracking and catching 3 prompt regressions before production.

**Structured outputs / Pydantic:**
> Standardised all agent tool outputs as Pydantic v2 models with Instructor, eliminating
> 100% of JSON parse errors in production and cutting downstream error-handling code by 60%.

**Safety / guardrails:**
> Implemented a prompt-injection defence layer using NeMo Guardrails and a custom
> red-team test suite, reducing adversarial input success rate from 12% to under 1%.
