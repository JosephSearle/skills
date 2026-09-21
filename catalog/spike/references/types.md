# Spike Types Reference

Primary authorities: SAFe 6.0 (scaledagileframework.com/spikes) | Agilemania — Naveen Kumar | Wikipedia — Spike (Software Development)

---

## 1. The Technical / Functional Distinction

The most important classification axis, applicable to all spike types:

**Technical spike** — investigates a technical approach, implementation risk, or technology capability. The question is engineering-shaped: "Can we do this? How would we do it? What does it cost?" Requires an engineer to design and execute. Output is technical evidence (benchmarks, prototype code, feasibility assessment).

**Functional spike** — investigates how the system should behave from a user, product, or business perspective. The question is behaviour-shaped: "Should we do this? What does the user need? What does compliance require?" May be led by a BA, designer, or Product Owner alongside engineering. Output is behavioural evidence (user research, compliance analysis, workflow validation).

The distinction determines **who should run the spike** and **how acceptance criteria are written**:
- Technical spike criteria: observable technical outcomes ("benchmark shows X", "API error rate under Y%")
- Functional spike criteria: business or UX outcomes ("5/5 test users complete the task", "legal confirms the approach meets GDPR Article 17")

---

## 2. SAFe 6.0 Enabler Story Types

SAFe classifies spikes as a type of Enabler Story. All SAFe spikes must be estimated, implemented within a sprint, and demonstrated at a System Demo.

| Type | Primary Question | Who Runs It | Typical Timebox | Deliverable Form |
|---|---|---|---|---|
| **Exploration** | What are the options for solving X? | Engineer + optionally BA/PO | 1–3 days | Options analysis with tradeoffs |
| **Architecture** | How should X be structured at the system level? | Architect + Engineer | 2–5 days | Architecture decision or ADR draft |
| **Infrastructure** | Can our infrastructure support X? What does it require? | DevOps / Platform Engineer | 1–3 days | Infrastructure spec or runbook draft |
| **Research** | What do we not know about X (domain, regulatory, market)? | BA, PO, or Specialist + Engineer | 3–5 days | Research summary with decision recommendation |
| **Design** | What should X look like or how should it behave? | Designer + UX Researcher | 2–4 days | Wireframes, prototypes, or design spec |
| **Prototyping** | Can we build a throwaway version of X to validate an assumption? | Engineer | 2–5 days | Throwaway prototype + feasibility assessment |

---

## 3. Extended Taxonomy (Agilemania)

Agilemania adds three types that are common in practice but absent from SAFe's formal taxonomy:

| Type | Primary Question | Who Runs It | Typical Timebox | Deliverable Form |
|---|---|---|---|---|
| **Technical** | Can we implement X using this technology/approach? | Engineer | 1–3 days | Feasibility assessment + risk register |
| **Performance** | Can X handle N load / scale? What are the limits? | Engineer (performance specialist) | 2–4 days | Benchmark results + scaling recommendation |
| **Usability** | Do users understand and successfully use X? | UX Researcher + Designer | 2–5 days | Usability findings + recommended changes |
| **Data** | What is the structure / quality / availability of X data? | Data Engineer or Analyst | 1–3 days | Data schema, quality report, or integration spec |
| **Functional** | Should X behave this way? Is X compliant / viable? | BA or PO + Engineer | 1–3 days | Business decision or compliance determination |

---

## 4. Type Selection — Disambiguation Guide

When two types seem equally applicable, use this table:

| Situation | Preferred type | Why |
|---|---|---|
| "We need to know if Redis can handle our load" | Performance | The question is about limits and scale, not feasibility |
| "We need to know if Redis is the right technology" | Technical (feasibility) | The question is about fit, not scale |
| "We need to decide between Redis and Postgres for sessions" | Exploration | Multiple options are being evaluated |
| "We need to know how to structure our auth system" | Architecture | The output is a structural decision |
| "We need to know if our deployment pipeline can support blue-green" | Infrastructure | The question is about the platform, not the application |
| "We need to know if users can navigate the new checkout flow" | Usability | The question is user-behaviour shaped |
| "We need to know if the checkout flow is compliant with PCI DSS" | Research (or Functional) | The question is domain / regulatory |
| "We need to validate a new data ingestion format from a vendor" | Data | The question is about data shape and availability |

---

## 5. Per-Type Acceptance Criteria Patterns

Acceptance criteria must be observable outcomes, never deliverables. Per-type patterns:

**Technical / Architecture / Infrastructure / Prototyping:**
```
We will know this spike is complete when:
- We have spent [N days] evaluating [technology/approach] against [criteria]
- We have documented [what we tried], [what we found], and [our recommendation]
```

**Research:**
```
We will know this spike is complete when:
- We have reviewed [sources] and synthesised findings on [question]
- We have produced a decision recommendation the team can act on
```

**Performance:**
```
We will know this spike is complete when:
- We have run benchmarks against [scenario] at [load target]
- We have documented p50/p95/p99 results and identified the bottleneck (if any)
```

**Usability / Design:**
```
We will know this spike is complete when:
- We have tested [prototype/flow] with [N] representative users
- We have documented [N] key findings and a prioritised list of changes
```

**Data:**
```
We will know this spike is complete when:
- We have profiled the [dataset/API] and documented its schema, quality, and completeness
- We have assessed whether the data meets the requirements for [intended use]
```

---

## 6. SAFe Demonstration Mandate

In SAFe, all spikes — regardless of type — must be:

1. **Estimated** before the sprint begins (in story points or ideal days)
2. **Completed within the sprint** — a spike that spans multiple sprints without a demo is a backlog item, not a spike
3. **Demonstrated** at the next System Demo — the findings, not the process

The demonstration does not have to be a running system. A slide, a benchmark printout, a design mockup, or a spoken summary of findings all satisfy the demo requirement. The point is that the learning is shared across the ART, not siloed in one team.
