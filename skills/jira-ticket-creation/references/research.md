# Effective Jira Tickets for Scrum & SAFe Delivery Teams — A Reference for an AI Skill

## 1. Executive Summary

An effective Jira ticket is unambiguous, self-contained, and matched to the right issue type so it carries exactly the information its audience needs to act without follow-up questions. Across all reputable sources — Atlassian's own docs, Scrum.org, Scrum Alliance, the Scaled Agile Framework (SAFe), the Agile Alliance, and PMI — the universal rules are: write a specific, descriptive title; capture the "why/what/how"; make work testable through clear acceptance criteria; link related work; and keep one ticket focused on one piece of work. For delivery-level work, user stories should satisfy Bill Wake's INVEST criteria — Wake developed the acronym and published "INVEST in Good Stories, and SMART Tasks" in April/August 2003 — and use the "As a… I want… so that…" user-voice form, with acceptance criteria often expressed in Gherkin's Given/When/Then. Larger work rolls up through a hierarchy — in Atlassian's native model Initiative → Epic → Story/Task/Bug → Sub-task, and in SAFe Epic → Capability → Feature → Story. Definition of Done (DoD) is a mandatory Scrum commitment applying to all items; Definition of Ready (DoR) is an optional complementary practice not in the Scrum Guide. Issue-type selection is driven primarily by scope/scale and intent: strategic outcomes are themes/initiatives/epics; user-facing value is stories/features; problems are bugs; operational work is tasks; and IT-service constructs (incident, service request, change request) follow ITIL semantics. The single biggest anti-pattern is the vague, untestable ticket lacking reproduction steps, acceptance criteria, or context.

## 2. General Best Practices (apply to all ticket types)

**Title / Summary**
- Be specific and descriptive; the title should convey the issue before the ticket is opened. Atlassian's classic guidance contrasts the bad "Space export doesn't work" with the good "Space export fails with NullPointerException when performed by the anonymous user."
- For work/tasks, phrase as an imperative starting with a verb (like a good commit message). For bugs, describe behaviour from the user's perspective.
- Avoid vague titles ("Something's wrong") that force the reader to open and read the whole ticket.

**Description — capture why, what, and how**
- The Atlassian Community guide "How to write a useful Jira ticket" frames the necessary content as the answers to **why, what, and how**: why the work matters and for whom (the user-story context), what needs to be done, and how (technical detail, links).
- Make the Jira ticket the single source of truth — pull in decisions from Slack/email/meetings rather than leaving them outside the ticket.
- Always choose a component and fill version fields where relevant (Affects Version/s for bugs in released versions; Fix Version/s for the resolving release).

**Clarity standards**
- State facts and observed behaviour, not assumptions ("The login button is unresponsive," not "the login button is broken").
- Quantify vague terms. "Fast"/"user-friendly" are untestable; replace with measurable thresholds (e.g., "search returns results within 200 ms," "checkout completes in under three steps").
- One ticket = one focused piece of work. Search for duplicates before creating a new ticket.

**Acceptance criteria (AC)**
- AC define the conditions a specific item must satisfy to be accepted; they are unique per item (contrast with DoD, which is global).
- Two dominant formats:
  - **Gherkin / Given-When-Then (BDD):** "Given [context], When [action], Then [observable outcome]." Codified around the Given/When/Then pattern by the Agile Alliance; focus on *what* the system does, not *how*.
  - **Rule-oriented checklist:** bullet list of pass/fail conditions; useful when an acceptance test satisfies several criteria.
- Best practices: each story should have at least one acceptance criterion; describe behaviour from the user's perspective; cover happy path and unhappy/edge paths; keep them declarative and testable. A common rule of thumb is 1–3 AC per story (4+ may signal the story should be split).
- Write AC during backlog refinement or sprint planning — early enough to give context, late enough to have it; avoid changing them mid-sprint once committed.

**INVEST (quality test for stories / PBIs)** — created by Bill Wake, who published the acronym in his April/August 2003 article "INVEST in Good Stories, and SMART Tasks" (with thanks to Mike Cohn):
- **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable.
- The criteria compete (independence vs. small); make trade-offs. SAFe restates INVEST for stories. The companion **SMART** acronym (Specific, Measurable, Achievable, Relevant, Time-boxed) applies to the decomposed tasks.

**The 3 Cs of a story** (Ron Jeffries): **Card** (written intent), **Conversation** (the discussion the card promises), **Confirmation** (the acceptance criteria).

**Definition of Ready vs. Definition of Done**
- **DoD** — a mandatory part of Scrum; a shared, global checklist defining when an increment meets quality standards and is releasable (e.g., code reviewed, tested, documented, NFRs/regulatory met). Applies to all PBIs. Owned by the whole team; when multiple teams work on one product they share one DoD.
- **DoR** — *not* part of the Scrum Guide; an optional, complementary practice listing criteria for a PBI to be pulled into a sprint (clear description, AC, estimate, dependencies identified). Risk: it can become a rigid "contract" / gatekeeping and lead to over-refinement. The Scrum Guide only says items are "ready for selection" when they can be Done within one sprint. Jeff Sutherland has argued a strong DoR materially improves team throughput, but Scrum.org coaches caution against treating it as a gate.

**Linking & dependencies**
- Surface relationships with Jira's "Link issue" feature. The most important is **blocks / is blocked by** — surface blocked work early (a "Blocked" swimlane/flag helps). Use this for critical-path visibility.

**Common anti-patterns to avoid**
- Vague/untestable descriptions; missing acceptance criteria.
- Bugs without steps to reproduce, environment, or expected vs. actual results.
- Tickets that mix multiple pieces of work.
- Mislabeled severity/priority (e.g., cosmetic bug marked Critical).
- Orphan tickets with no parent/epic link or no component.
- Treating epics as fixed-scope projects; over-deep hierarchies (7–8 levels nobody can track).
- Speculating about cause in a bug ("probably caused by the last update").

## 3. Per-Issue-Type Reference (16 types)

> Note on frameworks: Types 1–6 (Theme, Initiative, Capability, Epic, Feature, Story) span SAFe portfolio/program levels and Atlassian's native hierarchy. Types 7–16 are delivery/operational. Jira treats Story, Task, and Bug as the same standard level technically; the distinction is convention and reporting, not enforced behaviour.

### 1. Theme (strategic portfolio theme)
- **Purpose:** Highest-level strategic objective/organizational goal that drives the creation of epics and initiatives. In SAFe, **Strategic Themes** are, verbatim, "differentiating business objectives that connect a portfolio to the strategy of the Enterprise. They influence portfolio strategy and provide business context for portfolio decision-making," best stated as **OKRs**.
- **Template/structure:** Objective (qualitative strategic direction) + 2–4 measurable Key Results. Example: "Objective: Accelerate time-to-market for digital services. KR1: reduce average epic lead time by 30%. KR2: launch three new digital products by Q3."
- **Required fields:** Title (theme name), Objective statement, Key Results/metrics, owner (executives/enterprise architects/business owners), time horizon.
- **Quality indicators:** Differentiating (not "improve quality"); measurable; traceable from boardroom to backlog; periodically reviewed as markets shift.
- **Title format:** `[Theme] <Strategic objective phrase>` e.g., "Expand into adjacent EU markets."

### 2. Initiative (large cross-team initiative)
- **Purpose:** In Atlassian's native hierarchy, an initiative is a **collection of epics that drive toward a common goal**, often compiling epics from multiple teams; typically spans multiple quarters to a year.
- **Template/structure:** Goal statement / measurable outcome; list of constituent epics; success metric.
- **Required fields:** Title, objective/outcome (an outcome, not a feature — "Increase conversion to 25%," not "Launch new checkout"), owner, target horizon, child epics.
- **Quality indicators:** Bridges strategy and execution; measurable; bigger than any single epic. In Jira available via Plans/Advanced Roadmaps (premium). Note SAFe purists use Epic→Capability→Feature and don't use "initiative"; Atlassian's native model uses Initiative→Epic.
- **Title format:** `[Initiative] <Outcome>` e.g., "Decrease cost per launch by 5% this year."

### 3. Capability (SAFe Large Solution construct)
- **Purpose:** Per the official SAFe Glossary (verbatim), "A Capability represents large solution functionality whose implementation often spans multiple ARTs and is sized to be delivered within a PI." Used in SAFe's Large Solution configuration; decomposed into Features.
- **Template/structure (same as Feature):** Phrase/name + **benefit hypothesis** + **acceptance criteria** (including applicable NFRs). Business or Enabler capability.
- **Required fields:** Title (phrase), benefit hypothesis, acceptance criteria, owner (Solution Management), type (business/enabler).
- **Quality indicators:** Spans multiple ARTs; sized to fit one PI; clear measurable benefit; not micromanaged into features by the portfolio (leave decomposition to ARTs).
- **Title format:** `[Capability] <Solution behavior phrase>` e.g., "Cross-channel Customer Experience Engine."

### 4. Epic
- **Purpose (Atlassian native):** "A large body of work that can be broken down into a number of smaller stories"; few in number, spanning multiple sprints (teams often run 2–3 per quarter).
- **Purpose (SAFe):** Per Scaled Agile, "An Epic is a significant solution development initiative" — a substantial business venture requiring portfolio-level oversight, an MVP, a Lean business case, and a cost estimate; managed through a Portfolio Kanban. Two types: **Business epics** (deliver value directly to the customer) and **Enabler epics** (enhance the architectural runway).
- **Template/structure:**
  - *Atlassian/Scrum team epic:* Title, description/goal, child stories, target quarter/OKR link, reporting flag.
  - *SAFe Epic Hypothesis Statement* (SAFe 6 template): Funnel Entry Date, Epic Name, Epic Owner, Epic Description (elevator-pitch form: "For [customers] who [need], the [solution name] is a [type of solution] that [provides value], unlike [current alternative], our solution [differentiator]"), Business Outcomes (lagging measures), Leading Indicators (early measures to validate the hypothesis), Nonfunctional Requirements, and the MVP. *(The live SAFe /epic/ page now gates the full template behind login; the official DOCX is at framework.scaledagile.com/wp-content/uploads/2025/03/Epic-Hypothesis-Statement.docx, labeled "SAFe 6." Field list corroborated by official Scaled Agile assets and SAFe Fellow commentary.)*
- **Required fields:** Title, description, owner; (SAFe) benefit/business-outcome hypothesis, leading indicators, MVP, Lean business case.
- **Quality indicators:** Aligned to at least one strategic theme; decomposed early (before PI planning); treated as a hypothesis to validate, not a fixed project; sized to be delivered by an ART/within multiple sprints.
- **Title format:** `[Epic] <Capability/initiative name>` e.g., "Mobile banking international expansion."

### 5. Story (User Story)
- **Purpose:** Per the official SAFe Glossary (verbatim), "Stories are short descriptions of a small piece of desired functionality written from the user's perspective." The smallest unit of customer-visible value; fits in one sprint/iteration.
- **Template/structure:** User-voice form (verbatim SAFe): **"As a [user role], I want to [activity] so that [business value]."** Plus acceptance criteria (Gherkin or checklist). **Enabler stories** support exploration/architecture/infrastructure/compliance and may be written in technical language.
- **Required fields:** Title, user-story statement, acceptance criteria, story-point estimate, parent epic, (often) component.
- **Quality indicators:** Satisfies INVEST; small enough for one sprint; testable AC; keeps focus on a real persona; 1–3 AC ideal.
- **Title format:** Short capability phrase, e.g., "One-click payment on web checkout."

### 6. Feature (SAFe / product feature)
- **Purpose:** Per the SAFe "Features and Capabilities" page (verbatim), "A feature describes a product or solution functionality that offers business value, meets a stakeholder requirement, and can be completed by an Agile Release Train within a PI, (generally under 2 months of total effort)." Sits at the program/ART level between Epic/Capability and Story.
- **Template/structure:** **FAB** (feature-and-benefit) — Feature (short phrase/name giving context) + **Benefit hypothesis** (the proposed measurable benefit) + **Acceptance criteria** (mitigate implementation risk, enable early validation, include NFRs). Avoid the user-story voice for features (they serve multiple roles). Business or Enabler feature.
- **Required fields:** Title (phrase), benefit hypothesis, acceptance criteria, owner (Product Management), WSJF inputs for prioritization, parent epic/capability.
- **Quality indicators:** Sized for one PI/one ART; measurable benefit hypothesis; AC that validate the hypothesis; clear beneficiaries.
- **Title format:** `[Feature] <User-facing function>` e.g., "Enable loyalty rewards integration in mobile app."

### 7. Improvement (incremental enhancement)
- **Purpose:** An incremental improvement to existing functionality (distinct from a brand-new capability or a defect). Atlassian's classic bug-priority taxonomy lists "enhancement" as a severity; many teams use a dedicated Improvement type.
- **Template/structure:** Current behaviour → desired improved behaviour → rationale/value → AC.
- **Required fields:** Title, description (what exists today and what should change), value/justification, AC, parent epic if applicable.
- **Quality indicators:** Clearly references existing functionality; measurable benefit; not a defect (the feature works, but could be better); testable.
- **Title format:** Imperative improvement phrase, e.g., "Reduce dashboard load time from 4s to under 1s."

### 8. Bug (defect)
- **Purpose:** Records a defect where the product does not work as intended. Atlassian: "A bug is a problem which impairs or prevents the functions of a product."
- **Template/structure (universal bug formula):** **Steps to reproduce → Expected result → Actual result**, plus environment and visual evidence. Atlassian's rule: every bug report must include detailed steps to reproduce, what you expected, and what happened instead.
- **Required fields:** Descriptive title (behavioural), environment (OS/browser/version/device), numbered steps to reproduce, expected vs. actual result, **severity** (technical impact) and **priority** (business urgency) as independent axes, Affects Version/s (released version where reproduced), attachments (screenshot/recording/console logs).
- **Quality indicators:** Reproducible (note reproduction rate, e.g., 12/12); single defect per report; factual tone; severity ≠ priority (a Critical-severity bug in a retired feature may be Low priority; a minor checkout typo may be High priority).
- **Title format:** `<Feature> - <failure> when <condition>` e.g., "CART – cannot add item when quantity > 99 (Chrome 124)."

### 9. Test Case (QA)
- **Purpose:** A blueprint that verifies a specific functionality works as intended; compares actual vs. expected results. (ISTQB-aligned structure.)
- **Template/structure:** Test Case ID → Title/Objective → Preconditions → Test Data → Test Steps (atomic, ordered) → Expected Result → (Postconditions) → Actual Result → Status (Pass/Fail). Trace to the requirement/user story.
- **Required fields:** Unique ID (e.g., `LOGIN_TC_001`), objective, preconditions, steps, test data, expected result, status, requirement/story link.
- **Quality indicators:** Atomic (one objective); independent/reusable; specific expected results ("User sees 'Welcome back'", not "works"); traceable to a requirement; executable by someone unfamiliar with the feature. Agile teams keep them lightweight and tied to AC.
- **Title format:** `<Feature>: <scenario>` e.g., "Login: valid credentials redirect to dashboard."

### 10. Incident (production incident)
- **Purpose:** Per ITIL 4 (verbatim), an incident is "an unplanned interruption to a service or reduction in the quality of a service" requiring rapid restoration of service. (Note: ITIL 4 dropped "IT"; ITIL v3 read "an unplanned interruption to an IT service.") Atlassian Jira default: "Reporting an incident or IT service outage."
- **Template/structure:** Summary of impact → affected service/users → severity/priority → timeline → current status → resolution/workaround → post-incident review (for majors). Focus on **speed of restoration over root cause** (root cause = a Problem ticket).
- **Required fields:** Title, impact/scope (users/services affected), severity/priority, detection time, status, assignee/on-call, resolution notes, links to related incidents/problem.
- **Quality indicators:** Impact and urgency assessed by scope; clear escalation path; major incidents get a post-incident review and knowledge-base update; distinguished from a service request (planned) and a problem (root-cause investigation).
- **Title format:** `[INC] <service> <symptom>` e.g., "[INC] Checkout API returning 500 for all users."

### 11. Task (generic technical work)
- **Purpose:** A generic piece of work that needs to be done and isn't a user-facing feature or a defect — e.g., setting up a server, documentation, configuration, research, operational/maintenance work. Atlassian: "A task represents work that needs to be done."
- **Template/structure:** Imperative title → description of the exact action required → AC/definition of done → links.
- **Required fields:** Title (verb-first), description, assignee, estimate, parent story/epic if applicable.
- **Quality indicators:** Specific, single owner, completable in a few days (if longer/multi-person, break into sub-tasks); represents implementation/operational work rather than user value.
- **Title format:** "Configure CI pipeline for staging environment."

### 12. Risk (risk-log item)
- **Purpose:** Tracks a potential future event that could affect delivery, scope, budget, or quality — a risk-register/risk-log entry. PMI's Practice Standard for Project Risk Management underpins the fields.
- **Template/structure:** Risk description (include cause via "because/due to") → Category → Probability → Impact → Priority/score (Probability × Impact) → Response strategy (Avoid / Transfer / Mitigate / Accept) → Owner → Status (Open/In Progress/Closed/Occurred).
- **Required fields:** Title, description+cause, probability, impact, score, mitigation/response (specific, time-bound, assignable), owner, status, review cadence.
- **Quality indicators:** Specific and owned; honest scoring (most projects have only 3–5 truly high risks); actionable mitigation ("JD obtains backup vendor quote by Mar 15", not "monitor closely"); reviewed regularly; when it occurs, move to issue/incident. In Scrum, surface risks in refinement, reviews, and retrospectives.
- **Title format:** "Risk: key vendor may miss API delivery, blocking Q3 launch."

### 13. Maintenance / Tech Debt
- **Purpose:** Tracks maintenance and technical-debt work — "outstanding work promised but not delivered, defects in code, or work items that hurt agility" (Atlassian). Includes out-of-date libraries, refactoring, build/deploy tooling.
- **Template/structure:** Description of the debt/maintenance need → impact on velocity/quality/risk → proposed remediation → AC. Many teams tag with a `TechDebt` label and keep it in the **same backlog** as features for unified prioritization.
- **Required fields:** Title, description, impact (performance/maintenance/risk), remediation approach, estimate, label/component.
- **Quality indicators:** Categorized (code/architecture/test/documentation debt); impact quantified; in one backlog with features; balanced against feature work via an explicit ratio (e.g., 20–30% capacity). OpenLMIS's documented practice: log tech debt as a **Task** with a `TechDebt` label (not as Stories/improvements; a Bug only if it blocks stated functionality).
- **Title format:** "Tech debt: upgrade Spring Boot 2.x → 3.x across services."

### 14. Change Request (formal change)
- **Purpose:** A formal request to add, modify, or remove something affecting a service/system — per ITIL, "the addition, modification, or removal of anything that could have a direct or indirect effect on services." Atlassian default: "Requesting a change in the current IT profile."
- **Template/structure / RFC:** Description of change → business justification → risk assessment → implementation plan → rollback plan → impact/affected CIs → schedule/maintenance window → approver(s). ITIL change types: **Standard** (pre-authorized, low-risk, no CAB each time), **Normal** (full risk assessment + CAB/Change Authority approval), **Emergency** (expedited via ECAB).
- **Required fields:** Title, change type, description, justification, risk/impact, implementation + rollback plan, requested window, approvals/CAB decision, status.
- **Quality indicators:** Correct change-type classification; documented risk and rollback; clear approver; minimal disruption; standardized RFC template.
- **Title format:** "[CR-Normal] Migrate payments DB to PostgreSQL 16."

### 15. Service Ticket (IT service / support request)
- **Purpose:** A formal **service request** — per ITIL a planned, pre-approved request for a standard service (access, new hardware/software, information). Distinct from an incident (unplanned outage). Atlassian default: "Requesting help from an internal or customer service team" / "Requesting new capability or software feature."
- **Template/structure:** Requested service (ideally chosen from a service catalog) → requester details → justification → approvals (if needed) → fulfillment steps → SLA/expected completion.
- **Required fields:** Title, service category (from catalog), requester, description/justification, priority, approver (if applicable), SLA/due date, status.
- **Quality indicators:** Maps to a catalog item; follows a predefined repeatable workflow; SLA-driven; clearly separated from incidents for reporting; one request per ticket.
- **Title format:** "[SR] Grant Jira admin access to Jane Doe."

### 16. Time-off (absence / leave)
- **Purpose:** Tracks team-member absence/leave so capacity and sprint planning reflect availability. Not a delivery artifact — a capacity/HR-style record.
- **Template/structure:** Requester → absence type (vacation/sick/public holiday) → start/end dates → total days → approver → status.
- **Required fields:** Title, person, leave type, start date, end date, duration, approver, status.
- **Quality indicators:** Accurate dates; linked to capacity planning (many planning tools factor vacations into capacity); approved; does not carry story points or pollute delivery velocity/reporting.
- **Title format:** "PTO: Jane Doe, 12–16 May (5 days)."

## 4. Hierarchy & Linking Guide

### 4.1 The two dominant hierarchies

**Atlassian native (default Jira):**
```
Initiative            (Plans/Advanced Roadmaps, premium)
  └── Epic            (multi-sprint body of work)
        ├── Story     (user value, one sprint)   ┐
        ├── Task      (technical/operational work) ├─ same level
        └── Bug       (defect)                     ┘
              └── Sub-task (breakdown of a story/task/bug)
```
Jira supports three levels out of the box (Epic → Story/Task/Bug → Sub-task); Initiative and above require Plans/Advanced Roadmaps. Story, Task, and Bug sit at the same standard level. A parent (Epic) can have Stories, Tasks, and Bugs as children; a Task can have Sub-tasks; a Sub-task has no children. Per Atlassian Support, "a work item can only display up to 500 child work items, we recommend limiting your work items to that amount" (limit introduced in Atlassian Cloud's March 2024 release).

**SAFe four-tier artifact hierarchy:**
```
Epic            (portfolio; needs MVP + Lean business case; Portfolio Kanban)
  └── Capability (Large Solution; spans multiple ARTs; sized for a PI)
        └── Feature (program/ART; delivered by one ART in one PI)
              └── Story (team; one iteration; user-voice form)
```
SAFe explicitly defines this as "a four-tier hierarchy of artifacts… Epic, Capability, Feature, and Story." Not every team uses all four — only Story and Feature are at the Essential level. Themes (Strategic Themes) sit above the portfolio as OKR-style business objectives that guide which epics enter the funnel.

**A pragmatic combined model many roadmaps converge on:** Theme/Strategic Goal → Initiative/Objective → Epic → Story → Task/Sub-task. The key advice from practitioners: the specific labels matter less than having **one consistent hierarchy everyone agrees on**; keep to 4–5 levels max (7–8 levels become unmanageable), and always keep a middle layer (epics/initiatives) bridging strategy and stories.

### 4.2 Parent/child vs. issue links

- **Parent–child (hierarchy):** Use the Parent field / Epic link to nest work for roll-up and breakdown (Epic → Story; Story → Sub-task). This is what drives boards, backlogs, and progress roll-up.
- **Issue links (lateral pointers):** A link is "a simple pointer from one issue to another." Default Jira link types and when to use each:
  - **blocks / is blocked by** — a hard dependency: the blocker must be resolved before the blocked item can progress. The most important link for critical-path management; surface via a Blocked swimlane/flag.
  - **relates to** — a generic, non-dependency connection (e.g., two items touching the same feature). Directional label but generic both ways.
  - **duplicates / is duplicated by** — one item is the same as another and won't be worked/tracked separately; used to close one without work.
  - **clones / is cloned by** — auto-created when you use Jira's Clone action to copy an issue; the clone is expected to diverge and be tracked separately (Atlassian advises against deleting the clone link type). Some practitioners remove the "clones" relationship once the copy is differentiated.
  - Other configurable types include **causes / is caused by**, **depends on**, **implements**, **is reviewed by**, **merged into** (admins can add custom types).
- **Rule of thumb:** Parent-child for decomposition and roll-up; "blocks" for sequencing/critical path; "relates to" for context; "duplicates" for closing dupes; "clones" only as the native copy artifact. Link types have *no* effect on Epic roll-up — that's the Parent/Epic-link field.

### 4.3 SAFe PI Planning relevance
- Epics live in the **Portfolio Backlog** (Portfolio Kanban, governed by Lean Portfolio Management, prioritized by WSJF). They decompose into Capabilities/Features as they move toward the **Program Backlog**.
- Features enter **PI Planning**, where ARTs negotiate scope/dependencies and break Features into Stories sized for iterations.
- Sizing test (from practitioners): if it needs LPM investment + multiple ARTs → **Epic**; if one ART can deliver it in a PI → **Feature**; if one team can do it in an iteration → **Story**.

### 4.4 Epics, Stories, Tasks, Bugs on a Scrum board
- The Epic is the top of the team board; Stories/Tasks/Bugs are the sprint-level items nested under epics (set board swimlanes to "Epic" to see the roll-up). Sub-tasks break those down. Higher levels (Initiative/Theme) live in Plans/Advanced Roadmaps, not the sprint board.

## 5. Decision Logic — choosing the right issue type

### 5.1 Primary axis: scope/scale (for value-delivery work)
| If the work… | Use |
|---|---|
| Is an enterprise OKR-style business objective | **Theme / Strategic Theme** |
| Is an outcome spanning many epics/teams over multiple quarters | **Initiative** |
| Is large solution functionality spanning multiple ARTs (SAFe Large Solution) | **Capability** |
| Is a large body of work spanning multiple sprints / needs an MVP + business case | **Epic** |
| Delivers user-facing value, deliverable by one ART in one PI | **Feature** (SAFe) |
| Delivers user value, completable in one sprint | **Story** |
| Is a specific technical/operational action with no direct user value | **Task** |
| Breaks a story/task/bug into smaller chunks | **Sub-task** |

Heuristic restating the time test: completable in one sprint → Story/Task; within a PI → Epic/Feature; multi-PI / cross-ART → Capability/Epic.

### 5.2 Intent-based decisions (delivery & operational)
- **Story vs. Task:** Story = user-facing value/outcome in user-voice form; Task = implementation/operational/technical work with no direct user value. They sit at the same Jira level but differ in *intent and reporting* — keep a team convention.
- **Story vs. Improvement:** New user-facing capability → Story; making existing, working functionality better → Improvement.
- **Bug vs. Improvement vs. Story:** Product is broken vs. spec → **Bug**; product works but could be better → **Improvement**; new behaviour → **Story**.
- **Bug vs. Task:** Defect with reproduction steps → Bug; planned technical work → Task.
- **Tech debt:** Usually a **Task** labeled `TechDebt` (or a Maintenance type); a **Bug** only if it blocks stated functionality; can be an Epic if large.

### 5.3 ITIL service constructs
- **Incident:** something that worked now doesn't / unplanned outage → restore service fast.
- **Service Ticket (Service Request):** planned, pre-approved standard request (access, software, info) → fulfill via catalog workflow.
- **Change Request:** formal add/modify/remove affecting a service → RFC + risk + approval (Standard/Normal/Emergency).
- **Problem (if used):** root-cause investigation behind one or more incidents.
- Quick test: "Worked yesterday, broken today" → Incident; "Need something new/standard" → Service Request; "Modify a system under change control" → Change Request.

### 5.4 Common misclassifications to flag
- Logging everything as an Incident (overloads escalation; planned asks are Service Requests).
- Calling an outcome ("Increase conversion to 25%") a feature, or a feature ("Launch checkout") an objective.
- Filing a defect as a Story, or planned work as a Bug.
- Treating an epic-sized initiative as a feature, bypassing portfolio governance.
- Over-deep custom hierarchies; inconsistent Story/Task usage that corrupts reporting.

## 6. Recommendations (for building the Claude skill)

**Stage 1 — Classify before drafting.** Have the skill first run the §5 decision logic: ask (or infer) scope/scale and intent, then select the issue type. If the work is ambiguous between Story/Task/Improvement/Bug, default to the §5.2 intent tests and state the assumption. Benchmark to change behaviour: if the user's org uses SAFe terms (Capability, ART, PI, WSJF), switch to the SAFe hierarchy and Feature/FAB templates; if they use Initiative/Epic, use Atlassian-native.

**Stage 2 — Apply the type-specific template (§3).** For each type, populate every "required field." Enforce the non-negotiables: bugs must have steps-to-reproduce + expected vs. actual + environment; stories must have user-voice statement + ≥1 testable AC; epics/features must have a benefit/outcome hypothesis; risks must have probability × impact + an owner + a specific, time-bound mitigation.

**Stage 3 — Quality-gate every ticket.** Before output, validate against the §2 checklist: specific title, quantified (no "fast"/"user-friendly"), one focused item, AC present and testable, parent link + component set. For stories, run the INVEST check; if a story has 4+ AC or can't fit a sprint, recommend splitting.

**Stage 4 — Default AC format and linking.** Default to Gherkin Given/When/Then for stories/features (fall back to a checklist when multiple conditions share one test). Auto-suggest links: `blocks` for hard dependencies, `relates to` for context, parent/Epic-link for roll-up. Never use link types to express hierarchy.

**Thresholds that change the recommendation:**
- Scope crosses one sprint → escalate Story → Epic. Crosses one PI / multiple ARTs → Epic/Capability.
- A "bug" where the feature actually works as specified → reclassify as Improvement.
- A "service request" that is an unplanned outage → reclassify as Incident.
- Tech-debt item that blocks stated functionality → Bug, else Task/Maintenance.
- DoR: include it only if the team explicitly wants one, and frame it as guidance, not a gate.

## 7. Caveats

- **Terminology is not universal.** Jira technically treats Story/Task/Bug identically; "initiative," "epic," and "theme" mean different things in Scrum, SAFe, LeSS, and at different company sizes. The skill should adopt one consistent hierarchy per workspace rather than assert a single "correct" set of definitions.
- **SAFe vs. Atlassian native differ deliberately.** SAFe purists use Epic → Capability → Feature → Story and do not use "Initiative"; Atlassian's native model uses Initiative → Epic → Story. Don't mix them in one project.
- **DoR is contested.** It is not in the Scrum Guide; treat as optional. Sutherland cites throughput gains, but Scrum.org coaches warn it can become gatekeeping.
- **ITIL version drift.** ITIL 4 defines an incident as "an unplanned interruption to a service" (it dropped "IT" from the v3 wording); change-management role names (CAB/ECAB, Change Authority) and the four/three change-type taxonomies vary by ITIL version and tool. Several ITIL points here are corroborated from vendor docs (BMC, Freshworks, ServiceNow, ManageEngine) rather than the paywalled AXELOS source.
- **Primary-source access limits.** The live SAFe Epic and Features/Capabilities article bodies now sit behind a login; the public definition sentences and glossary were quoted verbatim, but the full Epic Hypothesis Statement template block was reconstructed from official Scaled Agile assets (the SAFe 6 DOCX) and SAFe Fellow commentary — flagged accordingly.
- **Time-off and capacity items** are not delivery artifacts; keep them out of velocity/story-point reporting. Many teams track these in a separate project or HR tool rather than the delivery board.
- **Bug/test-case/risk templates** draw partly on tool-vendor sources (BrowserStack, TestRail, Smartsheet, Marker.io) and ISTQB/PMI-aligned structures; field names are stable but exact field sets vary by organization and should be adapted to local Jira screen schemes.