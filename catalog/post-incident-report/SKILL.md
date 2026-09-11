---
name: post-incident-report
description: Writes the final "how we got here" post-incident report -- the organizational learning document produced after the calibration document exists and the learning-review meeting has happened. Based on PagerDuty's Howie Guide (meet/report/distribute pages) combined with Google's SRE Workbook postmortem-culture chapter as the standard for report rigor, quantified impact, blameless language, and durable action items. Use this whenever someone has a calibration document (from the post-incident-calibration skill or elsewhere) plus meeting notes/outcomes and wants the final incident report, postmortem, or "how we got here" writeup; wants to turn incident findings into an organization-wide learning document; or asks to finalize/publish/write up a post-incident review after the calibration meeting. This is the last document-producing step in the post-incident process -- it does not run the meeting itself and does not handle actual distribution/publishing.
summary: Writes the final "how we got here" post-incident report after the calibration meeting has happened, blending PagerDuty's Howie Guide narrative structure with Google's SRE Workbook as the standard for rigor.
---

# Post-Incident Report

Writes the final incident report: the narrative "how we got here" document
that gets shared across the organization once the learning-review meeting has
happened. This is the last step in the post-incident process that produces a
document -- everything before it (Identify, Analyze, Interview, Calibrate,
Meet) exists to give this report something true to say.

## Scope and sources of truth

This skill draws on two sources, used for different things -- don't blend
them into generic postmortem-writing instinct:

- **Process and narrative philosophy**, from three pages of PagerDuty's Howie
  Guide:
  - Meet -- https://howie-guide.pagerduty.com/meet/ (context only; see
    `references/meet-and-distribute-context.md` -- this skill does not
    facilitate the meeting)
  - Report -- https://howie-guide.pagerduty.com/report/ (see
    `references/report.md` -- this is what the skill actually produces)
  - Distribute -- https://howie-guide.pagerduty.com/distribute/ (context
    only; see `references/meet-and-distribute-context.md` -- this skill does
    not publish or circulate anything)
- **Document rigor and mechanics**, from Google's SRE Workbook chapter on
  postmortem culture -- https://sre.google/workbook/postmortem-culture/ (see
  `references/sre-workbook-standard.md`). Treat this as the golden standard
  for the things Howie's Report page doesn't spell out in detail: what header
  metadata to carry, how to quantify impact, how deep a root cause needs to
  go, concrete blameless-language phrasing, and what makes an action item
  survive contact with a backlog instead of rotting there.

When the two sources overlap -- blamelessness, learning over blame, action
items that actually get done -- they agree, and either is fine to reach for.
Where they'd pull in different directions, Howie's narrative, multi-perspective
storytelling shape wins for the report's overall structure and voice; the SRE
Workbook wins for how rigorously any given fact, root cause, or action item
gets written. In practice this means: write a story, not a form -- but make
sure the story contains everything the form would have demanded of it.

As with the calibration skill this follows, don't reach for generic
postmortem conventions from elsewhere when a judgment call comes up about
what the report needs. General knowledge is fine for pure mechanics
(formatting a table, wording a sentence); the two sources above are the
standard for what the document itself must do.

## Read this before drafting

`references/report.md` is the core spec for the deliverable -- read it first.
`references/sre-workbook-standard.md` has the structural and rigor details to
apply while drafting. `references/meet-and-distribute-context.md` explains
why the report needs meeting output as an input and why it's written the way
it is (for downstream distribution) -- it's background for understanding the
inputs and audience, not a set of steps to run.

## Workflow

### 1. Check what's actually available before drafting anything

The report depends on more than the calibration document alone. Before
writing, establish:

- **The calibration document** (or equivalent -- a timeline, themes, and
  interview findings from earlier phases). If this doesn't exist yet, that's
  a strong signal to point the user at the post-incident-calibration skill
  first rather than trying to reconstruct Identify/Analyze/Interview from
  scratch inside this skill -- that's a different, earlier stage of the
  process with its own data-gating discipline.
- **What came out of the learning-review meeting** -- corrections to the
  timeline or themes, resolved (or still-unresolved) open questions,
  knowledge-sharing that surfaced live, and agreed action items with owners.
  This can arrive as meeting notes, a transcript, a summary someone typed up
  after the fact, or the user relaying it conversationally. If no meeting has
  happened, or nobody captured what came out of it, say so plainly and ask
  for it -- see `references/meet-and-distribute-context.md` for why this
  matters. A report drafted straight from the calibration document's *open
  questions*, treating them as if the meeting had resolved them, is exactly
  the kind of fabrication this whole process exists to avoid. If the user
  says explicitly that there was no formal meeting, that's a legitimate
  answer to work from -- note it as a real constraint on how much alignment
  the report reflects, don't insist on a meeting that didn't happen.
- **Any other supporting data** worth pulling forward -- incident tickets,
  design docs, dashboards, quantified impact numbers -- if it exists and
  wasn't already folded into the calibration document.

If real gaps remain after asking, proceed with what's available and mark the
rest -- in the report's own "Open questions that remain unresolved" section,
not by quietly filling it in. A report with an honest unresolved-questions
section is more useful, and more trustworthy to the people who lived through
the incident, than one that reads as complete but isn't.

### 2. Draft the report

Use `assets/incident-report-template.md` as the structure. It blends Howie's
narrative "how we got here" shape with the SRE Workbook's concrete sections
(header metadata, quantified impact, three-way lessons-learned split,
consolidated action-item table, glossary). Follow the guidance in both
reference files while filling it in -- in particular:

- Write the "how things unfolded" section as an actual narrative that a
  non-participant could follow, not a bullet-point timeline restated from the
  calibration document.
- If the calibration document showed genuinely divergent perspectives between
  participants, don't flatten them into one voice -- showing where
  understanding diverged (and when/how it converged) is part of the story
  Howie's Report page asks for.
- Push contributing-factor analysis one layer past the first plausible
  explanation, per the SRE Workbook's root-cause guidance, and use its
  blameless-language phrasing (describe what the system allowed, not who
  made a mistake).
- Consolidate every action item into the single table, each with an owner,
  category, priority, and a verifiable completion condition -- even if
  several were discussed in different places in the narrative above.
- Write for an audience broader than the responders themselves: define
  acronyms, give background on unfamiliar systems, and keep it readable by
  someone in support, product, or leadership. This is what makes the report
  usable once it reaches the Distribute phase, even though this skill
  doesn't do the distributing itself.

### 3. Flag the boundary on the way out

Hand back the finished report as the deliverable, and be direct that this is
where this skill's job ends: it doesn't run or facilitate the meeting, and it
doesn't publish or circulate the report (newsletters, blog posts, all-hands
slides, etc. -- see `references/meet-and-distribute-context.md`). If the user
wants help with either of those, name it as a distinct, adjacent task rather
than quietly taking it on.
