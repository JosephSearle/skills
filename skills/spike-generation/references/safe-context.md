# SAFe Context Reference

Primary authority: Scaled Agile Framework (SAFe) 6.0 — scaledagileframework.com/spikes

Load this reference only when SAFe signals are detected in the user's request or context documents.
Signals: ART, PI Planning, System Demo, Enabler Story, WSJF, RTE, Solution Train.

---

## 1. SAFe Enabler Story Requirements

In SAFe, all spikes are classified as Enabler Stories. Every SAFe spike must satisfy three formal requirements that are absent from the base spike format:

**1. Estimated before the sprint begins.**
The spike must be estimated in story points or ideal days before it enters the sprint. A spike that cannot be estimated at all is too large — split it. Estimating the spike is possible because the timebox makes it bounded: the team is not estimating the output, they are estimating the cost of the investigation.

**2. Completed within the sprint.**
A spike that spans multiple sprints without producing findings and a demonstration is not a spike — it has become an unbounded investigation. If a spike cannot be completed within one sprint, split it into a feasibility spike (sprint 1) and a deeper investigation spike (sprint 2).

**3. Demonstrated at the next System Demo.**
The findings must be shared at the ART's next System Demo. The demonstration does not require a running system. A slide deck, a benchmark report, a design walkthrough, or a spoken summary of findings all satisfy the requirement. The purpose is ART-wide knowledge transfer, not product delivery.

---

## 2. Required Additions to the Spike Document

When SAFe context is detected, the spike document must include:

### Stakeholders and Demo Audience (required section — not optional)

```markdown
## Stakeholders and Demo Audience

| Role | Name / Team |
|---|---|
| ART / Team receiving findings | <ART or team name> |
| System Demo date | <YYYY-MM-DD> |
| Requesting stakeholder | <name or role> |
| Other interested parties | <names or roles, or —> |
```

### Findings — "Shared to" Subsection

Add a fourth sub-section to the Findings stub:

```markdown
### Shared to
- [ ] Demonstrated at System Demo on <YYYY-MM-DD>
- [ ] Findings shared to <ART or team> on <date>
- [ ] Enabler Story <ticket> updated to Done
```

### Acceptance Criteria Format

SAFe Enabler Stories use either Given/When/Then or a checkbox list. Both forms are acceptable:

**Given/When/Then:**
```
Given the spike timebox of [N days] has been completed,
When the team presents findings at the System Demo,
Then the ART can confirm whether [assumption] is validated or refuted.
```

**Checkbox list:**
```
- [ ] Spike timebox ([N days]) has elapsed
- [ ] Findings document is complete (What We Tried, What We Learned, Evidence and Links)
- [ ] Recommendation has been presented at System Demo
- [ ] Enabler Story has been updated to reflect the decision
```

---

## 3. WSJF Escalation Signal

WSJF (Weighted Shortest Job First) is SAFe's prioritisation model. A spike's WSJF score should be escalated when:

- The spike is blocking **more than one user story** — each blocked story increases the cost of delay
- The spike is blocking stories across **more than one team** within the ART — cross-team delays compound
- The spike is on the **critical path for a PI objective** — missing a PI objective affects the ART's planned value delivery
- The spike has been **deferred across more than one sprint** — deferral itself signals a high cost of delay

When any of these signals are present, flag them in the Risks and Open Questions section:

```markdown
| Risk / Question | Impact if unresolved |
|---|---|
| This spike is blocking N stories across M teams | Cost of delay escalates each sprint — recommend raising WSJF priority |
```

---

## 4. Status Lifecycle in SAFe

| Status | Meaning | Backlog placement |
|---|---|---|
| Draft | Spike has been written; not yet estimated or started | Product Backlog / Enabler Backlog |
| In Progress | Spike is running within the current sprint | Sprint Backlog |
| Completed | Findings are documented and demonstrated at System Demo | Done — Enabler board |
| Abandoned | Spike was stopped before timebox ended; findings are partial | Done (with note) — Enabler board |

A spike should never remain In Progress across sprint boundaries without a System Demo. If it does, assess whether it should be abandoned (findings documented as partial) and a follow-on spike scoped.

---

## 5. Post-Write Guidance (SAFe)

After writing a spike document in SAFe context, append the following to the standard post-write output:

```
SAFe next steps:
  - Estimate this Enabler Story before sprint planning ([N] points or ideal days)
  - Add it to the sprint backlog for the current or next sprint
  - Demonstrate findings at System Demo on <date>
  - Update Enabler Story <ticket> to Done after the demo
  - Check the "Shared to" boxes in the Findings section after sharing
```
