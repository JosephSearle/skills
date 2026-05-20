# JD Parser Sub-Prompt

## Purpose

Parse a job description into a structured JSON object that drives gap analysis,
profile tailoring, and bullet rewriting. Must return **strict JSON only** — no
prose wrapping, no markdown fences, no commentary before or after.

---

## Instructions (embed verbatim in the parse step)

Given the following job description text, extract a JSON object matching
the schema below. Rules:

1. `top_5_responsibilities` — the five most prominent responsibilities in priority order.
   Use the JD's own language where possible (verbatim phrases help ATS matching).
2. `top_10_must_have_keywords` — hard technical requirements: frameworks, tools,
   languages, patterns. Infer from "required", "must have", "essential", or
   prominent repetition. Use canonical forms from the keyword vocabulary
   (e.g. "LangGraph" not "lang graph", "Retrieval-Augmented Generation (RAG)").
3. `top_5_nice_to_haves` — "preferred", "nice to have", "bonus", "desirable".
4. `company_stage` — infer from signals:
   - "seed" / "pre-seed" / <20 employees → `seed`
   - Series A / "early-stage" / 20–80 employees → `series-a`
   - Series B / 80–250 employees → `series-b`
   - Series C+ / "growth stage" / 250–1000 employees → `growth`
   - >1000 employees / "enterprise" / public company → `enterprise`
   - If ambiguous, use `scale-up` as default
5. `tone` — infer from the writing style:
   - Heavy on benchmarks, papers, fundamental research → `research`
   - Heavy on product metrics, user impact, velocity → `product`
   - Heavy on systems design, reliability, scale → `technical`
   - Heavy on client outcomes, delivery, stakeholder management → `consulting`
6. `mission_statement` — the company's stated mission (one sentence). If absent,
   derive from the role's stated purpose.
7. `company_values` — explicit cultural values ("move fast", "customer obsession",
   "safety first"). Max 5 items. Empty array if none stated.

---

## Output Schema

```json
{
  "company_name": "string",
  "company_stage": "seed | series-a | series-b | growth | enterprise | scale-up",
  "top_5_responsibilities": [
    "string (verbatim or near-verbatim from JD)"
  ],
  "top_10_must_have_keywords": [
    "string (canonical form from keyword vocabulary)"
  ],
  "top_5_nice_to_haves": [
    "string"
  ],
  "company_values": [
    "string"
  ],
  "mission_statement": "string",
  "tone": "research | product | technical | consulting"
}
```

---

## Gap Analysis — After Parsing

Once the JD JSON is produced, compare against the CV JSON Resume:

```
For each item in top_10_must_have_keywords:
  Does the canonical term OR a known alias appear anywhere in the CV JSON
  (basics, skills, work.highlights, projects)?
    └─ YES → mark `present`
    └─ NO  → mark `missing` — flag for Skills section or targeted bullet

For each item in top_5_responsibilities:
  Do any work.highlights bullets address this responsibility?
    └─ YES → note the best-matching bullet
    └─ NO  → mark as `uncovered` — candidate needs a new bullet or
              this responsibility must be captured in the profile
```

Output the gap analysis as:

```json
{
  "keyword_coverage": {
    "present":  ["LangGraph", "Milvus", "LangFuse"],
    "missing":  ["agentic RAG", "OpenTelemetry GenAI"]
  },
  "responsibility_coverage": {
    "covered":   ["Build and maintain RAG pipelines", "Own CI/CD for agent systems"],
    "uncovered": ["Lead technical design reviews with stakeholders"]
  }
}
```

Present uncovered responsibilities to the user and ask whether they have relevant
experience to add — do not invent bullets.
