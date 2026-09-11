# Context only: Meet and Distribute (not run by this skill)

This skill does not facilitate the learning-review meeting and does not handle
publishing or circulating the finished report. Both are live/organizational
activities that happen outside a document-generation task. This file exists so
that whoever is using this skill -- or whoever built it -- understands *why*
the report's inputs are shaped the way they are, and knows what to ask for if
it's missing. Read it for context; don't try to "run" either phase.

## Meet (https://howie-guide.pagerduty.com/meet/) -- why its output matters here

The meeting is a facilitated discussion where participants go through the
calibration document together for the first time as a group: how things
happened, what unfolded, what was surprising, the themes, and what's still
unclear. Critically, **the meeting itself is data** that feeds the report --
it is not a rubber-stamp on the calibration document. Its typical outputs are:

- Corrections and additional context to the calibration document's timeline
  and themes, from people reacting to it live
- Knowledge-sharing from subject-matter experts that wasn't captured in
  interviews
- Resolution of some of the calibration document's open questions (and
  possibly new ones)
- Action items with owners and rough timelines, agreed on either during the
  meeting or as a fast follow-up
- Optional: participant feedback on the process itself, facilitator notes on
  what worked and what didn't

**Practical implication for this skill:** a calibration document alone is not
sufficient input for a final report if a meeting was supposed to happen and
hasn't yet, or happened but nobody captured what came out of it. When that's
the situation, say so plainly and ask for meeting notes, a recording
transcript, or a summary of what changed -- rather than treating the
calibration document's *open* questions as if they were answered, or drafting
a narrative that skips straight from Interview to a finished story. If the
user says there was no formal meeting (small incident, informal sync, etc.),
that's a legitimate answer -- capture it as such rather than insisting on a
meeting that didn't happen, but flag that the report is working from less
alignment than the process is designed to have.

## Distribute (https://howie-guide.pagerduty.com/distribute/) -- why report structure anticipates it

Distribution is about getting the finished report actually read across the
organization, not filed away -- newsletters, blog posts, team-meeting
synopses, all-hands presentations, and treating the report as a living
document that keeps being useful as new people read it. The Guide's point is
that a report's value is realized through people outside the original
incident room learning from it.

**Practical implication for this skill:** this is the reason the Report
phase's own guidance (see `report.md`) insists on being readable by people who
weren't there -- defining acronyms, giving background on unfamiliar systems,
and keeping the narrative frame rather than a wall of technical facts.
Producing a report that reads well is what makes distribution possible later;
this skill should optimize for that even though it never touches the actual
publishing step. If the user asks this skill to also write the newsletter
blurb, the all-hands slide, or otherwise handle distribution itself, that's a
reasonable adjacent ask but is outside what this skill is scoped to -- say so
rather than quietly doing it, the same way post-incident-calibration draws its
own boundary at the edge of the Calibrate phase.
