# Howie Guide -- Report phase (https://howie-guide.pagerduty.com/report/)

This is the primary source for what this skill produces. Read this file before drafting.

## What the report is for

The goal is a report that tells the story of how things unfolded -- a "how we got
here" report. This is explicitly **not** a standard postmortem in the
list-the-facts sense. The Guide's own framing: a "how we got here" is different
from a standard postmortem in that it is primarily focused on the story of what
happened and how the events came to be. A report that's just a set of facts from
a single point of view is hard to learn from -- the whole value of doing Identify,
Analyze, and Interview first is that the report can weave multiple perspectives
into one coherent narrative instead of reporting the incident from only the
loudest or most technical voice in the room.

## How it differs from the Calibration Document

The Calibration Document (output of the earlier post-incident-calibration skill)
is an interim, pre-meeting alignment tool -- deliberately unfinished, full of open
questions phrased for participants to correct. The final report is the opposite:
a comprehensive organizational record produced *after* the learning review
meeting, once participants have had a chance to react, correct, and add
context. It integrates:

- The calibration document's timeline and themes (now corrected/confirmed)
- Interview findings
- Whatever surfaced during the Meet phase discussion -- corrections, new
  context from subject-matter experts, agreed-on action items
- Any follow-up clarifications individuals gave after the meeting

Treat a calibration document alone, with no meeting having happened yet, as
insufficient input for a final report -- see "Data-gating" below and the
handoff note in SKILL.md.

## What the report should include

The Guide does not hand over a rigid section-by-section template on this page
(the actual worked example is a separate PDF produced jointly with Netflix,
Slack, and Adaptive Capacity Labs, referenced but not reproduced in full here),
but it's explicit about the content that needs to be present:

- The narrative account of how the incident developed -- not just what failed,
  but how the situation came to be, including the reasonable-seeming decisions
  people made in the moment with the information they had
- Contributing factors, presented narratively rather than as a bare list --
  technical failures *and* the social/organizational processes around them
  (on-call load, tooling gaps, unclear ownership, time pressure, etc.)
- Background on the technology involved, with enough historical/contextual
  detail that someone outside the immediate team can follow it
- Incident coordination details -- who did what, how information moved (or
  didn't) between people during the response
- Action items, consolidated into a single view so readers don't have to hunt
  through the narrative to find what's actually changing as a result
- A link to the meeting recording, if one exists and is being kept

## Audience and tone

The report is written for people in different roles -- not just the engineers
who were in the room. That means: explain acronyms and system names on first
use, don't assume the reader watched the incident unfold, and keep the
narrative readable by someone in support, product, or leadership as well as
the responders themselves. This is the same "several different roles get a
chance to learn from the incident" idea that drives the later Distribute
phase (see `meet-and-distribute-context.md`) -- a report that only an SRE can
parse won't travel past the team that wrote it.

## Data-gating (same discipline as the rest of the Howie process)

Everything upstream of this skill (Identify, Analyze, Interview, Calibrate,
and now Meet) exists to make sure the report is grounded in what actually
happened rather than a plausible reconstruction. Never invent a meeting
outcome, a corrected timeline detail, an action item, or an owner that wasn't
actually provided. If the calibration document's open questions were never
resolved -- because the meeting didn't address them, or didn't happen yet --
say so in the report rather than quietly picking an answer. A report that
looks complete but contains invented resolutions is worse than one that
honestly flags what's still unresolved, for the same reason a fabricated
calibration document is worse than an honest one: the people who were there
will notice, and it breaks trust in every report that follows.
