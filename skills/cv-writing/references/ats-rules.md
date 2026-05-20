# ATS Optimisation Rules

## Platform Landscape (UK scale-ups, 2025)

| Company stage | Common ATS |
|--------------|-----------|
| Seed – Series B (scale-ups) | Greenhouse, Ashby, Lever |
| Series C+ / growth | Workable, Ashby |
| Enterprise / large corporates | Workday, SmartRecruiters, SAP SuccessFactors |
| Early stage / startups | Workable, Lever, or direct email |

Greenhouse and Ashby expose the parsed candidate profile to the applicant — the
only reliable test is to upload and review the parsed output before submitting.

---

## Parsing Pitfalls — What Breaks ATS

Eliminate these from every CV output:

| Pitfall | Why it breaks ATS | Fix |
|---------|------------------|-----|
| Multi-column layout | Parsers read left-to-right, top-to-bottom — columns merge into garbled text | Single-column only |
| Tables for skills | Cell content may be read out of order or skipped | Plain comma-separated lists |
| Text boxes | Content is often skipped entirely | Inline body text |
| Text inside images / graphics | OCR is unreliable or absent | Remove or replace with plain text |
| Icons beside section headers | Some parsers read icon glyph codes as gibberish | Plain text headers only |
| Contact info in header/footer | Header/footer regions are frequently ignored | Put contact info in the body |
| Non-standard section names | Keyword matching relies on known patterns | Use standard names (see below) |
| Hyperlinks as long raw URLs | Fine for PDF view; ensure URL text is clean | Format as `site.com/path` |
| PDF created from image scan | Not text-selectable; no content extracted | Ensure PDF is text-based |

---

## Standard Section Names

Use exactly these headings — do not rename them:

| Standard name | Acceptable variants | Avoid |
|--------------|--------------------|----|
| Profile | Personal Statement | About Me, Summary (unless US format), My Journey |
| Skills | Technical Skills, Key Skills | Expertise, Competencies, Stack |
| Experience | Professional Experience, Work History | My Career, Background |
| Education | — | Academic Background, Qualifications |
| Projects | Selected Projects, Open Source | Side Projects, Hobby Work |
| Certifications | Certificates | Credentials |
| Publications | Publications & Talks | — |

---

## Keyword Strategy

ATS keyword matching is largely **literal substring matching**. Rules:

1. **Use exact JD phrasing** — if the JD says "LangGraph", the CV must say "LangGraph" (not "Lang Graph" or "langgraph")
2. **Expand acronyms on first use** — write "Retrieval-Augmented Generation (RAG)" in the profile or skills section, then "RAG" is safe to use alone thereafter
3. **Include both forms** — "Model Context Protocol (MCP)" in Skills; "MCP" in Experience bullets
4. **Do not abbreviate framework names** — "LangGraph" not "LG"; "LlamaIndex" not "LI"
5. **Density target** — aim for the top 8–12 hard skills from the JD to appear naturally across Profile + Skills + Experience
6. **No hidden text or keyword stuffing** — white text on white background or tiny font is detected and results in automatic rejection

---

## ATS Lint Checklist

Run this 12-point check on every CV before delivering. Report `PASS` or `FAIL` with a one-line note.

- [ ] **1. Single-column layout** — no side columns, no tables for layout
- [ ] **2. No tables, text boxes, or images containing text**
- [ ] **3. Contact info in the document body** — not in a header or footer region
- [ ] **4. Standard section names** — Profile, Skills, Experience, Education (see table above)
- [ ] **5. Dates in `MMM YYYY – MMM YYYY` format** — consistent throughout all roles
- [ ] **6. Text-selectable PDF** — not a scanned image; all text copyable
- [ ] **7. File named `Firstname-Lastname-CV.pdf`** — no spaces, no version numbers
- [ ] **8. All JD must-have keywords present at least once** — check against gap analysis
- [ ] **9. Acronyms expanded on first use** — RAG, MCP, LLMOps, etc.
- [ ] **10. UK English spelling throughout** — optimise, specialised, behaviour, organisation
- [ ] **11. No photo, DOB, marital status, or nationality**
- [ ] **12. LinkedIn and GitHub are real hyperlinks** — not plain text that looks like a URL

---

## File Naming Convention

`Firstname-Lastname-CV.pdf`

- Use the candidate's legal first name and surname
- Separate with hyphens, no spaces
- Some ATS index the filename — consistent naming helps recruiters find the file
- Do not include version numbers (`CV-v3.pdf`), dates (`CV-May-2025.pdf`), or role names
