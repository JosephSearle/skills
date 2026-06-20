---
name: jira-ticket-creation
description: >
  Creates well-structured Jira tickets for the 7 priority issue types — Story,
  Bug, Epic, Task, Feature, Test Case, and Improvement — via the Atlassian MCP
  integration. Classifies work from user input using INVEST, SAFe, and Atlassian
  hierarchy logic; gathers required fields conversationally; validates quality
  rules (measurable AC, outcome-framed epics, severity/priority separation);
  and requires explicit user confirmation before creating. Triggered by: "create
  a Jira ticket", "log a bug in Jira", "write a Jira story", "create an epic",
  "add a task to Jira", "create a feature ticket", "file a test case", "raise a
  Jira improvement", "open a Jira issue".
version: 1.0.0
---

# Jira Ticket Creation

This skill guides an agent through the full lifecycle of creating a Jira ticket: classifying the work, gathering required fields through targeted conversation, validating the draft against quality rules, obtaining explicit user confirmation, and submitting via the Atlassian MCP. It handles all 7 priority issue types with full template support, and makes a best-effort attempt for the remaining 9 types.

---

## Step 1 — Resolve context

**Detect Atlassian MCP availability.** Attempt to list tools or call a lightweight probe. If the Atlassian MCP server is not available, inform the user and continue — the skill will output a formatted plain-text draft for manual creation instead of submitting it.

**Identify the Jira project.** Ask the user which Jira project to create the ticket in, or use the Atlassian MCP to list available projects and let the user choose. Store the project key for the MCP call in Step 7.

**Detect the org framework.** Scan the user's input for SAFe terminology:
- If the user uses "PI", "ART", "WSJF", "Capability", "SAFe", or "Program Increment" → activate SAFe hierarchy: `Epic → Capability → Feature → Story`
- Otherwise → activate Atlassian-native hierarchy: `Initiative → Epic → Story / Task / Bug → Sub-task`

State the detected framework and invite correction: _"I'm treating this as an Atlassian-native Jira project — let me know if you're using SAFe."_

---

## Step 2 — Classify the issue type

Load `references/research.md` §5 (Decision Logic). Run the following decision tree against the user's input:

### Service-management branch

```
Is this about something that stopped working unexpectedly?
  └─ YES → Incident

Is this a standard, pre-approved request (access grant, new software, info)?
  └─ YES → Service Ticket

Is this a formal request to add/modify/remove something under change control?
  └─ YES → Change Request
```
For Incident, Service Ticket, and Change Request: acknowledge the type, note that full template support is not yet available for these types, and attempt a best-effort draft using `references/research.md` §3.

### Value-delivery / operational branch

```
Enterprise OKR or strategic business objective?             → Theme
Outcome spanning many epics / multiple teams / multi-quarter? → Initiative
Large body of work, multiple sprints, needs MVP or business case?
  └─ SAFe + spans multiple ARTs?                            → Capability (SAFe)
  └─ Otherwise                                              → Epic
User-facing capability, one ART can deliver in one PI?      → Feature (SAFe context)
User-facing value, completable in one sprint?               → Story
Existing feature is broken / does not behave as specified?  → Bug
Existing feature works but could be measurably better?      → Improvement
Technical / operational work with no direct user value?     → Task
Verifying a specific behaviour in QA?                       → Test Case
```

For Theme, Initiative, Capability, Risk, Maintenance, and Time-off: acknowledge, note limited template support, and attempt best-effort from `references/research.md` §3.

**Present the classification with a one-sentence rationale.** Example: _"This fits a Story — it delivers user-facing value and sounds completable in one sprint. Does that sound right, or would you like a different type?"_ Wait for the user to confirm or override before proceeding.

---

## Step 3 — Gather required fields

Load `references/templates.md` for the confirmed issue type. Review the Fields table to identify what is required vs optional.

**Infer before asking.** Apply these inference rules first:
- **Component**: derive from the feature/system mentioned (e.g. "checkout page" → `Checkout`)
- **Labels**: derive from type and keywords (e.g. `performance`, `frontend`, `devops`)
- **Parent epic**: use if the user names an epic or provides a key
- **Framework**: already resolved in Step 1

**Ask only for fields that cannot be inferred.** Use targeted, single questions — do not dump a full form at the user. Per type:

| Type | Fields that always require asking |
|---|---|
| Story | Persona (if not provided) — "Who is the user performing this action?" |
| Bug | Environment, steps to reproduce, expected result, actual result, severity (technical impact), priority (business urgency), affected version |
| Epic | Target quarter/PI, owner, benefit hypothesis (if goal described in feature terms, reframe as outcome first) |
| Feature | Measurable benefit hypothesis (if only the feature is described), NFRs, target PI, owner |
| Test Case | Linked story/AC key, test case ID prefix (e.g. `LOGIN`), preconditions, test data, test type |
| Improvement | Current behaviour (specific, factual), desired behaviour, confirmation that the feature works as specified |
| Task | Exact deliverable ("done when" conditions), estimate, component |

**Optional fields**: Do not ask for them. Include them in the draft with `[optional — add if known]` placeholders. Invite the user to fill them before confirming.

If a user cannot provide a required field (e.g. they don't know the parent epic key), note the gap in the draft and warn that the field must be populated before the ticket is created.

---

## Step 4 — Draft the ticket

Load `references/templates.md` for the confirmed type. Populate every required field using the exact template structure defined there — field names, headings, and formats must match.

Apply the per-type agent guidance rules from `references/templates.md`:

- **Story**: User-story statement in `As a [persona], I want to [action] so that [benefit]` form. Never write "The system shall…". AC in Gherkin `Given / When / Then` format.
- **Bug**: Title format `[Feature] – [failure behaviour] when [condition]`. Actual Result must be factual — no speculation about cause.
- **Epic**: Goal/Outcome must be a measurable outcome, not a feature description. Benefit hypothesis must include "We will know this is true when [measurable indicator]."
- **Feature**: FAB format for the Feature Statement. No user-story voice. NFRs as a separate section.
- **Test Case**: Steps must be atomic (one action per step). Expected Result must be observable and specific.
- **Improvement**: Current Behaviour is factual, not a complaint. AC must be measurable.
- **Task**: Title starts with an imperative verb. "Done When" criteria must be specific and verifiable.

For the 9 types with limited template support, draft the ticket using the structure and required fields from `references/research.md` §3, and prepend: _"Note: this issue type does not yet have full template support. This is a best-effort draft — review carefully before creating."_

---

## Step 5 — Validate the draft

Load `references/research.md` §2 (universal quality rules) and §3 (per-type quality indicators). Run the following checks before presenting the draft.

### Universal checks (all types)

- [ ] Title is specific and descriptive — no vague nouns ("Something is wrong"), no filler
- [ ] No untestable qualifiers: "fast", "user-friendly", "better", "improved" — flag and ask for a measurable replacement
- [ ] One focused piece of work — flag if multiple unrelated items are bundled
- [ ] Component is set
- [ ] Parent/Epic link is set (or flagged as missing if unknown)

### Story

- [ ] User-story statement uses user-voice form
- [ ] Each AC answers a binary pass/fail — if not, rewrite it
- [ ] AC count: 1–3. If 4+ → _"This story has [N] acceptance criteria. That's usually a signal to split. Would you like to proceed anyway, or split into multiple stories?"_
- [ ] INVEST check: flag failures on Testable and Small specifically
- [ ] Estimate ≥ 13 → _"A 13-point estimate usually means this story should be split."_

### Bug

- [ ] Severity and Priority are both present as separate fields
- [ ] Steps to reproduce start from a documented, clean state
- [ ] Actual Result contains no speculation ("probably", "might be", "I think")
- [ ] Expected Result references designed behaviour, not just "it should work"
- [ ] Feature works as specified? If yes → _"This sounds like an Improvement rather than a Bug — the feature works as specified but could be better. Should I reclassify?"_

### Epic

- [ ] Goal/Outcome is a measurable outcome, not a feature description — if feature-framed, rewrite and confirm
- [ ] Benefit hypothesis includes a falsifiable "we will know when…" clause
- [ ] Scope In and Scope Out are both populated
- [ ] Fits in one sprint? → suggest reclassifying as Story or Feature
- [ ] Spans multiple quarters or teams? → suggest escalating to Initiative

### Task

- [ ] Title starts with an imperative verb
- [ ] "Done When" criteria are specific and verifiable
- [ ] Delivers direct user-visible value? → _"This sounds like it delivers user-facing value. Should I reclassify as a Story?"_
- [ ] Estimate > 2 days and multiple independent parts? → suggest sub-tasks

### Feature

- [ ] Feature Statement follows FAB format
- [ ] Benefit is measurable (a specific, quantified outcome)
- [ ] Not written in user-story voice
- [ ] At least one NFR is present
- [ ] Scope > one PI → _"This sounds larger than one PI. Should I escalate to an Epic?"_

### Test Case

- [ ] Linked to a story or AC — no orphan test cases
- [ ] Steps are atomic (one action per step)
- [ ] Expected Result is observable and specific
- [ ] Preconditions are complete enough to run without follow-up questions
- [ ] Test Data uses non-production values

### Improvement

- [ ] Current Behaviour is factual and specific
- [ ] AC are measurable (not "faster" or "better UX")
- [ ] Feature currently works as specified (else → Bug)
- [ ] Building something that doesn't exist? → reclassify as Story or Feature

For any failed check: flag the issue to the user with the specific field and the problem, and offer corrected wording. Resolve all failures before presenting the final draft.

---

## Step 6 — Present and confirm

Present the complete draft as formatted Markdown. Use clear section headings matching the template field names.

Below the draft, list any optional fields that are still unpopulated with their `[optional — add if known]` placeholders. Invite the user to fill them in this turn.

End with: _"Does this look right? Reply 'yes', 'create it', or 'looks good' to create the ticket, or tell me what to change."_

**Do not create the ticket until the user gives explicit confirmation.** If the user requests changes, update the draft and re-present. Do not re-run the full validation loop — only re-check the changed fields.

---

## Step 7 — Create via Atlassian MCP

**Duplicate check.** Before creating, call the Atlassian MCP search tool with a JQL query matching the title keywords (e.g. `summary ~ "keyword" AND project = "PROJ"`). If matches are found, present them: _"I found [N] existing issue(s) with a similar title: [list]. Is this a new ticket or a duplicate?"_ Proceed only after the user confirms it is new work.

**Map draft fields to Jira API fields:**

| Draft field | Jira API field |
|---|---|
| Title | `summary` |
| All description fields | `description` (Atlassian Document Format / markdown) |
| Acceptance Criteria | Appended to `description` under `## Acceptance Criteria` |
| Severity | `customfield_<id>` (query available fields for the project if standard `priority` doesn't separate severity) |
| Priority | `priority.name` |
| Story Points | `story_points` or `customfield_10016` (verify field name for the instance) |
| Parent Epic | `parent.key` or `customfield_10014` |
| Component | `components[].name` |
| Labels | `labels[]` |
| Affects Version/s | `versions[].name` |
| Assignee | `assignee.accountId` |

**Tool resolution**: The exact Atlassian MCP tool names vary by server configuration. At runtime, resolve the correct names for: list projects, get issue types, search issues, and create issue. Prefer tools that match these operations by name; fall back to the most specific available tool.

**Call create issue** with all required fields populated. On success, return the created issue key and URL: _"Created: [PROJECT-123] — [link]"_

**If the Atlassian MCP is unavailable**: output the complete formatted draft as plain text and inform the user: _"The Atlassian MCP is not available. Here is the complete ticket — paste it into Jira manually."_

---

## Hard Rules

1. Never submit a ticket with required fields missing or containing placeholder values.
2. Never create a ticket without explicit user confirmation of the draft ("yes", "create it", "looks good", or equivalent).
3. Severity and Priority must always be populated as independent fields on Bug tickets — never merge them into a single field.
4. The draft → validate → confirm → create flow is mandatory for all issue types, including the 9 types with limited template support.
5. Never speculate about the cause of a defect in the Actual Result field.
6. The user-story statement must always use user-voice form ("As a… I want… so that…"). Never substitute "The system shall…" or technical framings.
7. If the Atlassian MCP is unavailable, output the formatted ticket as plain text and inform the user it must be created manually. Do not attempt direct REST API calls.
8. Never create a test case without a linked story or acceptance criterion.
9. Reclassification suggestions are always suggestions — the user makes the final decision on issue type.

---

## References

- [research.md](references/research.md) — classification logic (§5), universal quality rules (§2), all 16 issue-type definitions (§3)
- [templates.md](references/templates.md) — field tables, agent guidance rules, and fully populated examples for the 7 priority types
