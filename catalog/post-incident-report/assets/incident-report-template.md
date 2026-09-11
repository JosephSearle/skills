# How We Got Here: <Incident name/ID>

*Final incident report. Supersedes the interim calibration document -- this
reflects the learning-review meeting and any follow-up clarifications.*

| | |
|---|---|
| **Owner** | <single named point of contact for this report> |
| **Shared with** | <distribution list -- default to broad/org-wide per the Distribute phase, unless told otherwise> |
| **Incident date** | <date/time range> |
| **Report published** | <date> |
| **Status** | Draft / Circulating for feedback / Final |
| **Meeting recording** | <link, if one exists and is being kept -- omit this row if not applicable> |

## Executive summary

<2-4 sentences: what happened, quantified impact if known, and the headline
root cause. A reader should get the shape of the incident from this alone.>

## Background

<Enough context on the systems/technology involved that someone outside the
team can follow the narrative below -- historical context, what the system
normally does, any domain terms defined here or in the glossary.>

## The story: how things unfolded

<This is the heart of the report and should read as a narrative, not a bullet
timeline -- weave together what different people saw and did, in the order it
happened, including decisions that were reasonable given what was known at
the time. Pull from the corrected/confirmed calibration document timeline,
interview findings, and whatever the meeting added or corrected. Don't
flatten multiple perspectives into one voice if they meaningfully differed --
showing where people's understanding diverged, and when it converged, is
part of the story.>

## Contributing factors

<Narrative, not just a list -- technical failures alongside the social and
organizational conditions around them (on-call load, ownership gaps, tooling,
time pressure, prior decisions that made sense at the time). For each factor,
push past the first plausible explanation to the systemic gap underneath it
-- see references/sre-workbook-standard.md's root-cause guidance. Use
blameless, system-focused language throughout: describe what the system or
process allowed, not who made a mistake.>

## Incident coordination

<How the response was organized -- who was doing what, how information moved
between people and teams, what worked about the coordination and what made it
harder than it needed to be.>

## Impact

<Quantified wherever the underlying data supports it -- duration, affected
systems/products, percentage or count of users affected, business impact if
known. Where a number isn't available, say so explicitly rather than using
vague language like "significant" in its place.>

## Lessons learned

**What went well**
<...>

**What went poorly**
<...>

**Where we got lucky**
<This bucket is easy to skip -- a near-miss that worked out by chance is a
real gap even though it didn't cause damage this time.>

## Open questions that remain unresolved

<Anything the calibration document flagged, or that came up in the meeting,
that still doesn't have an answer. Say so plainly rather than presenting a
guess as settled -- this section should shrink from the calibration
document's "Known gaps," not silently disappear.>

## Action items

| Owner | Item | Category | Priority | Done means... |
|-------|------|----------|----------|----------------|
| <name> | <specific, concrete change> | Prevent / Mitigate / Detect / Repair | P0/P1/P2 | <verifiable completion condition> |

<Consolidate every action item into this single table even if several were
discussed in different parts of the narrative above -- readers shouldn't have
to hunt for what's actually changing as a result of this incident.>

## Glossary

<Define acronyms and system/team names used above that a reader outside the
immediate team wouldn't already know.>
