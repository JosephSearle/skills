---
name: cv-writing
description: >
  Create or enhance a CV/resume for AI/ML engineers. Triggers on: "write my cv",
  "create a cv", "update my cv", "improve my cv", "tailor my cv for [company]",
  "rewrite my resume", "help with my cv", "cv for [role]", or any request to
  create, tailor, or improve a CV or resume document. Operates in two modes:
  CREATE (new CV from scratch) and ENHANCE (rewrite an existing CV against a
  target job description). Applies UK CV conventions by default, XYZ bullet
  formula, ATS optimisation, and a controlled keyword vocabulary for agentic
  AI / LLMOps roles.
---

# CV Writing

## Core Philosophy

A CV is a targeting document, not a biography. Every word should advance the
reader's confidence that this candidate can do the specific job on offer.
Optimise for the hiring manager who skims for 10 seconds and the ATS that
keyword-matches before any human sees it.

---

## Step 1 — Detect mode and gather inputs

Determine which mode applies:

```
Does the user provide an existing CV (pasted text, file path, or attachment)?
  └─ YES → ENHANCE mode
  └─ NO  → CREATE mode
```

**ENHANCE mode** — ask for, or extract from context:
1. Existing CV (pasted Markdown/text or file path)
2. Target JD (pasted text, URL to paste from, or company name + role title)

**CREATE mode** — collect all of the following before proceeding:
1. Full name and contact details (city, country, phone, email, LinkedIn, GitHub)
2. Career history: for each role — company, title, dates, 3–5 key achievements with numbers
3. Education: institution, degree, class (e.g. 2:1), year
4. Technical skills: languages, frameworks, tools, platforms
5. Projects or open-source work (optional but recommended for scale-ups)
6. Target role title and company (or company type)

**For both modes**, also identify:
- Target country: default **UK** unless user specifies otherwise
- Target company stage: `scale-up` | `enterprise` | `big-tech` | `academic`
- Seniority: `graduate` | `mid` | `senior` | `staff/principal`

If any critical input is missing after one pass, ask a single consolidated
question listing everything needed rather than asking one field at a time.

---

## Step 2 — Parse inputs into JSON Resume structure

Represent the CV internally as a JSON Resume object before rewriting anything.
This gives a stable diff between versions and prevents rewrite drift.

Key fields to populate:

```json
{
  "basics": {
    "name": "",
    "email": "",
    "phone": "",
    "location": { "city": "", "countryCode": "GB" },
    "profiles": [
      { "network": "LinkedIn", "url": "" },
      { "network": "GitHub",   "url": "" }
    ]
  },
  "work": [
    {
      "name": "",
      "position": "",
      "startDate": "YYYY-MM",
      "endDate":   "YYYY-MM",
      "highlights": ["XYZ bullet 1", "XYZ bullet 2"]
    }
  ],
  "education": [
    {
      "institution": "",
      "area": "",
      "studyType": "",
      "endDate": "YYYY",
      "score": "2:1"
    }
  ],
  "skills": [
    { "name": "Agentic Frameworks", "keywords": ["LangGraph", "LlamaIndex"] }
  ],
  "projects": [
    { "name": "", "description": "", "url": "", "highlights": [] }
  ]
}
```

Flag any obvious gaps at this stage (do not ask yet — consolidate with Step 3):
- No GitHub URL in `basics.profiles`
- No quantified metrics in any `highlights` entry
- Key skills cluster empty (e.g. no LLMOps / evals entries)
- Work history gap > 6 months unexplained

---

## Step 3 — Parse the target JD *(ENHANCE mode only)*

Load **`references/jd-parser.md`** and follow the sub-prompt to extract a
structured JD object. Output must be strict JSON:

```json
{
  "company_name": "",
  "company_stage": "scale-up | series-a | series-b | growth | enterprise",
  "top_5_responsibilities": [],
  "top_10_must_have_keywords": [],
  "top_5_nice_to_haves": [],
  "company_values": [],
  "mission_statement": "",
  "tone": "technical | product | research | consulting"
}
```

**Gap analysis** — after parsing the JD:
1. For each `top_10_must_have_keywords` item: check whether it appears (or a
   close alias) anywhere in the JSON Resume. Mark as `present` or `missing`.
2. For each `top_5_responsibilities`: identify the 1–2 strongest CV bullets
   that map to it. Note any responsibilities with no matching evidence.
3. Compile a gap list: missing keywords + uncovered responsibilities.

Consolidate any gathered flags from Step 2 into a single question block if
anything critical is absent before rewriting.

---

## Step 4 — Load reference files

**Always load:**
- `references/uk-conventions.md` — format, length, no-photo rules, UK spelling
- `references/ats-rules.md` — parsing pitfalls and lint checklist
- `references/section-order.md` — canonical section order and per-section rules
- `references/xyz-formula.md` — XYZ bullet formula, exemplars, action verbs
- `references/profile-templates.md` — profile structure and worked exemplars

**Load conditionally:**

```
Is the role AI/ML/LLMOps/agentic? (default YES for this skill)
  └─ YES → load references/keyword-vocabulary.md

Is the target country NOT the UK?
  └─ YES → override section length rules from uk-conventions.md:
            US: 1 page, "Summary" not "Profile", US spelling
            Other: ask user for local conventions
```

---

## Step 5 — Rewrite section by section

Work through sections in this order (from `references/section-order.md`):
**Profile → Technical Skills → Experience → Education → Projects → Certifications**

### Profile / Personal Statement

Using `references/profile-templates.md`:
- Structure: **identity** (years + specialism + key stack) → **proof** (1–2 flagship achievements with numbers) → **stack signal** (exact frameworks the target company uses) → **aim** (mirrors the JD's first 3 responsibilities or mission statement)
- Length: 50–80 words, first-person implicit (no "I")
- Use the matching exemplar from `profile-templates.md` as a template; swap in the candidate's actual data

### Technical Skills

- Group by cluster (e.g. Agentic Frameworks, LLMOps / Evals, Infra, Languages)
- Reorder clusters so the JD's top stack items appear in the first 1–2 groups
- Use canonical forms from `references/keyword-vocabulary.md`
- No skill bars, percentages, or ratings — plain comma-separated lists per category

### Experience

For each role, rewrite bullets using the XYZ formula (from `references/xyz-formula.md`):
- Target: **70% of bullets** hit all three of X + Y + Z
- Remaining 30%: two-element bullets (X + Z without Y) if the metric is genuinely unavailable
- Use the quantification ladder: percentages → absolute counts → money → time → scale
- Lead with the verb most relevant to the JD's top responsibilities
- Most recent role: 3–5 bullets; roles 2–3 years old: 2–3 bullets; older: 1–2 bullets or omit

```
Does a JD responsibility have no matching bullet?
  └─ YES → either write a new bullet if evidence was collected, or
            add to the gap log for the user to fill in
```

### Education

- Format: `Degree Class, Subject — Institution (Year)`
- Include degree class (UK convention: First, 2:1, 2:2, etc.)
- Omit if graduation is >10 years ago and experience is strong

### Projects / Open Source

- Include only if: repo is public and substantive, or project was in production
- 1–2 XYZ bullets per project; include a URL
- Omit entirely for mid-level+ if experience section already fills 2 pages

### Certifications

- Include only if directly relevant: CKAD, AWS/GCP/Azure ML, IBM Cloud
- Format: `Certification Name — Issuing Body (Month YYYY)`

---

## Step 6 — ATS lint pass

Run the 12-point checklist from `references/ats-rules.md`. For each item,
report `PASS` or `FAIL` with a one-line note on failures.

| # | Check |
|---|-------|
| 1 | Single-column layout (no side columns) |
| 2 | No tables, text boxes, or images containing text |
| 3 | Contact info in the document body — not in a header or footer |
| 4 | Standard section names: Profile, Skills, Experience, Education |
| 5 | Dates in `MMM YYYY – MMM YYYY` format throughout |
| 6 | Output is text-selectable (not a scanned image) |
| 7 | File named `Firstname-Lastname-CV.pdf` |
| 8 | All JD must-have keywords appear at least once |
| 9 | Acronyms expanded on first use (e.g. "Retrieval-Augmented Generation (RAG)") |
| 10 | UK English spelling throughout |
| 11 | No photo, DOB, marital status, or nationality |
| 12 | LinkedIn and GitHub are real hyperlinks, not plain text |

---

## Step 7 — Output

Produce three artefacts in order:

### 1. Rewritten CV (Markdown)

Clean single-column Markdown, ready to paste into a `.docx` template or pipe
through Pandoc to PDF. Follow the section order from `references/section-order.md`.

### 2. Change log

A bulleted diff of what changed and why — one line per significant change.
Example:
- Profile rewritten to mirror JD responsibilities (LangGraph orchestration, MCP server design)
- Added LangFuse to Skills → LLMOps cluster (was absent; JD lists as must-have)
- Bullet 3 in Role X rewritten: added latency metric (38% reduction) to satisfy XYZ formula

### 3. ATS match score

`Matched: 8 / 10 must-have keywords`

List any gaps:
- `agentic RAG` — not present; suggest adding to the Milvus project bullet
- `OpenTelemetry GenAI` — not present; suggest adding to observability bullet in Role X

---

## Reference Files

| File | When to load |
|------|-------------|
| `references/uk-conventions.md` | Always |
| `references/ats-rules.md` | Always |
| `references/section-order.md` | Always |
| `references/xyz-formula.md` | Always (experience bullets) |
| `references/profile-templates.md` | Always (profile section) |
| `references/keyword-vocabulary.md` | AI/ML/LLMOps roles (default) |
| `references/jd-parser.md` | ENHANCE mode only |
