# Section Order and Per-Section Rules

## Canonical Section Order (UK, AI/ML Engineer)

1. **Name + Contact** — name, city/country, phone, email, LinkedIn, GitHub
2. **Profile** — 50–80 word personal statement (see profile-templates.md)
3. **Technical Skills** — grouped by cluster, no ratings
4. **Professional Experience** — reverse chronological, 60–70% of page real estate
5. **Education** — degree, institution, year, class
6. **Projects / Open Source** — optional; include if substantive
7. **Certifications** — optional; include only if directly relevant
8. **Publications / Talks** — optional; include only if directly relevant

---

## What to Include vs. Omit

### Include

| Section | When |
|---------|------|
| Name + Contact | Always |
| Profile | Always |
| Technical Skills | Always |
| Professional Experience | Always (unless graduate with no work history) |
| Education | Always |
| Projects / Open Source | If at least one public repo with meaningful activity, or a production deployment |
| Certifications | CKAD, AWS/GCP/Azure ML, IBM Cloud certs — include if < 3 years old |
| Publications / Talks | Include if peer-reviewed, conference talk, or blog post with significant reach |

### Omit

| Item | Reason |
|------|--------|
| Photo | Equality Act 2010 / ATS parsing |
| Date of birth | Legal / discrimination risk |
| Marital status | Irrelevant; legal risk |
| Nationality | Irrelevant at application stage |
| Full postal address | City + country only |
| "References available on request" | Assumed; wastes space |
| Hobbies / interests | Omit unless directly relevant (ML side projects, open-source, hackathons, technical blog) |
| Skill bars / 1–5 ratings | Meaningless and ATS-unparseable |
| Objective statement | Generic; replace with a targeted Profile |
| Jobs older than 7 years (for a 3–5 year engineer) | List company/title/dates only or omit; no bullets |
| Irrelevant work history (e.g. retail for a senior engineer) | Omit or condense to one line |

---

## Per-Section Rules

### Name + Contact

```
Alex Smith
London, UK · +44 7700 900000 · alex@example.com · linkedin.com/in/alexsmith · github.com/alexsmith
```

- One line of contact details beneath the name
- City and country only — no street address
- Phone in international format: `+44 XXXX XXXXXX`
- LinkedIn: shortened URL (`linkedin.com/in/username`)
- GitHub: `github.com/username`
- No header/footer — all contact info in the document body

---

### Profile

- 50–80 words maximum
- First-person implicit (no "I")
- Structured: identity → proof → stack signal → aim (see profile-templates.md)

---

### Technical Skills

Group into clusters — do not use a flat list or skill bars:

```
Agentic Frameworks:   LangGraph, LlamaIndex, AutoGen, DSPy, Instructor
LLMOps / Evals:       LangFuse, LangSmith, Ragas, DeepEval, OpenTelemetry GenAI
RAG / Vector DBs:     Milvus, pgvector, hybrid search, BM25, bge-reranker
Inference / Serving:  vLLM, Ollama, Modal, Baseten
Fine-Tuning:          LoRA, QLoRA, PEFT, DPO, Axolotl, TRL
Infra / DevOps:       Kubernetes, OpenShift, ArgoCD, Tekton, GitHub Actions
Languages:            Python, TypeScript, Go
Cloud:                AWS Bedrock, Azure OpenAI, GCP Vertex AI
```

Rules:
- Reorder clusters so the JD's top stack appears first
- Use canonical forms from keyword-vocabulary.md
- Separate items with commas — no bullets, no ratings, no icons

---

### Professional Experience

```
Senior AI Engineer — Acme Corp, London, UK
Jan 2023 – Present

- Bullet 1 (XYZ format)
- Bullet 2
- Bullet 3 (3–5 bullets for most recent role)
```

Rules:
- Reverse chronological order (most recent first)
- Format: `Job Title — Company, City, Country`
- Dates: `MMM YYYY – MMM YYYY` or `MMM YYYY – Present`
- Include a one-line company context if the employer is not well-known:
  `Acme Corp (Series B AI platform, 120 employees)`
- 3–5 bullets for most recent role; taper to 1–2 for roles > 3 years old
- Use XYZ formula (see xyz-formula.md)
- Start every bullet with an action verb from the approved list

---

### Education

```
MEng Computer Science, First Class — University of Manchester (2019)
BSc Mathematics, 2:1 — University of Leeds (2018)
```

Rules:
- Format: `Degree Class, Subject — Institution (Year)`
- Include class: First, 2:1, 2:2, Third (UK convention; omit for US-format CVs)
- Most recent qualification first
- Include A-levels only if a graduate with no work experience
- Omit if graduation is > 10 years ago and experience section is strong (2+ relevant roles)

---

### Projects / Open Source

```
LangGraph RAG Toolkit (github.com/username/repo)
- Built a reusable LangGraph supervisor + RAG sub-agent template used in 3 production deployments
- Reduced new project setup from 2 weeks to 3 days (stars: 280, forks: 45)
```

Rules:
- Include only if: public repo with substantive commits, or production deployment
- 1–2 XYZ bullets per project
- Include the URL as a real hyperlink
- List most impactful project first

---

### Certifications

```
Certified Kubernetes Application Developer (CKAD) — Cloud Native Computing Foundation (Mar 2024)
AWS Certified Machine Learning – Specialty — Amazon Web Services (Jan 2023)
```

Rules:
- Include only if < 3 years old and directly relevant to the target role
- Format: `Certification Name — Issuing Body (Mon YYYY)`
- Do not include expired certifications

---

### Publications / Talks

```
"Agentic RAG at Scale: Lessons from 12M Monthly Queries" — AI Engineer Summit, London (Nov 2024)
"Continuous Fine-Tuning with LangFuse Failure Traces" — blog.example.com (Aug 2024, 4k reads)
```

Rules:
- Include only if directly relevant (LLM/AI/ML topic)
- Format: `"Title" — Venue or URL (Month Year)`
- For blog posts: include approximate readership if notable (≥1k reads)
- For papers: include venue and DOI or arXiv link

---

## Seniority-Specific Adjustments

| Seniority | Adjustments |
|----------|------------|
| Graduate | 1 page; Education before Experience; include A-levels; include academic projects |
| Mid-level | 2 pages; Experience before Education; 3 most recent roles in full |
| Senior | 2 pages; add "Selected Projects" with architecture links; shift profile from "doing" to "leading" |
| Staff / Principal | 2–3 pages; include "Areas of Impact" or "Selected Initiatives"; mention team/org scope |

## Company-Type Adjustments

| Target | Adjustments |
|--------|------------|
| AI-native scale-up | Lead with agentic stack, production scale numbers, open artefacts |
| Big Tech (FAANG, DeepMind) | Lead with distributed systems metrics, complexity, fundamentals; add systems design signals |
| Enterprise (banks, consulting) | Add compliance keywords (SOC2, ISO 27001, GDPR); lead with platform-engineering depth |
| Academic / research lab | Move Education above Experience; include publications, GPA, advisors |
