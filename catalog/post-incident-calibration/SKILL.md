---
name: post-incident-calibration
description: Runs the Identify, Analyze, Interview, and Calibrate phases of a post-incident review, in that order, and produces a Calibration Document -- the pre-meeting findings summary shared with incident participants before the learning-review meeting. Based strictly on PagerDuty's Howie Guide (identify/analyze/interview/calibrate pages). Use whenever someone asks to run a post-incident review, post-mortem, incident retro, or "Howie" process; wants an incident timeline built from chat transcripts, alert logs, or on-call data; needs interview questions prepared for responders; or asks for a calibration doc or pre-review findings summary. Also use it when raw incident data (chat exports, alert logs, on-call schedules) is shared and needs to become a structured narrative or interview plan, even if the process isn't named. Stops once the Calibration Document is ready -- does not facilitate the live meeting or write the final incident report.
summary: Runs the Identify, Analyze, Interview, and Calibrate phases of a post-incident review to produce a pre-meeting Calibration Document, based strictly on PagerDuty's Howie Guide.
---

# Post-Incident Calibration

Walks a post-incident review through four phases, in order -- Identify, Analyze, Interview, Calibrate -- and produces a Calibration Document: the interim findings summary that goes out to incident participants before the calibration meeting. This is deliberately a scoped slice of a larger post-incident process, not the whole thing.

## Scope and source of truth

Everything about what each phase means, what "done" looks like, and what the final document should contain comes from four pages of PagerDuty's Howie Guide, and only those four:

- Identify -- https://howie-guide.pagerduty.com/identify/ (see `references/identify.md`)
- Analyze -- https://howie-guide.pagerduty.com/analyze/ (see `references/analyze.md`)
- Interview -- https://howie-guide.pagerduty.com/interview/ (see `references/interview.md`)
- Calibrate -- https://howie-guide.pagerduty.com/calibrate/ (see `references/calibrate.md`)

When a judgment call comes up about what counts as thorough enough, don't reach for general incident-management or blameless-postmortem knowledge from elsewhere -- these four pages are the standard this skill is built to. General knowledge is fine for things that are genuinely just mechanics (formatting a table, wording a question naturally) but not for deciding what the process itself requires.

This skill's job ends at a finished Calibration Document. Facilitating the actual calibration meeting where participants react to it, and writing the final incident report afterward, are later stages of a full post-incident process that aren't covered by these four pages -- say so if asked to go further, rather than improvising a facilitation script or a final-report format that has no basis in the source material.

## Why the order matters, and why data-gating matters more

Each phase's output is the next phase's input: Identify produces the roster of who/what was involved, Analyze turns that into a timeline and a shortlist of who to interview, Interview surfaces what the data alone can't show, and Calibrate consolidates all of it into something falsifiable that participants can react to. Skipping a phase doesn't just skip a step -- it means the later phases are working from a gap they don't know they have (an un-interviewed participant whose account would have changed the timeline, a system nobody flagged as involved).

Because of that, the single most important discipline in this skill is refusing to fabricate. A calibration document is only useful if participants trust it enough to correct it -- and inventing a plausible-sounding timeline entry, a quote no one said, or an interviewee who wasn't actually spoken to breaks that trust the moment someone notices, which they will, because they were there. So at every phase: check what data is actually available, and if something needed is missing, ask for it (or ask whether it exists anywhere) rather than filling the gap with a reasonable-sounding guess. It's entirely normal, and better, for a Calibration Document to have an explicit "Known gaps" section than to have every field filled in with something unverified.

## Workflow

### Starting point: does prior-phase work already exist?

Before assuming you're starting from zero, ask (or check what's been shared) whether earlier phases have already happened -- a team might come to this skill with a timeline already built and interviews already done, wanting help only with Calibrate. In that case, use what already exists rather than redoing it, but still sanity-check it against that phase's data checklist (in the relevant reference file) before treating it as sufficient input to the next phase. If someone asks to jump straight to a calibration document with no prior data at all, walk them through Identify and Analyze first (even briefly) rather than producing a document with no basis -- "in that exact order" means the process runs in this sequence, not that every phase needs the same depth every time.

### 1. Identify

Read `references/identify.md` for the full detail. In short: establish who was involved (teams, individuals, tenure, on-call duration) and what systems were touched, using chat transcripts, org-chart knowledge, and related channels as sources. Work through that file's data checklist before moving on; ask for whatever's missing and can't be inferred.

### 2. Analyze

Read `references/analyze.md`. Turn the Identify roster and raw data (chat transcripts, alert logs, dashboards, on-call schedules) into a timeline, a first-pass tagging/grouping of events, a narrative draft, a running list of open questions, and a shortlist of who needs to be interviewed and why. This is iterative and doesn't need to be exhaustive on the first pass -- go as deep as the available time and data support, and say so if you're stopping short.

### 3. Interview

Read `references/interview.md`. For each shortlisted person, either prepare a tailored interview guide, conduct a live text-based interview if the developer is relaying real-time answers, or synthesize notes/transcripts from interviews that already happened -- whichever actually matches what's going on. Pull out themes and any unanswered questions from whatever interview material results.

### 4. Calibrate

Read `references/calibrate.md`. Consolidate everything -- transcripts, technical data, interview notes -- into the Calibration Document, using `assets/calibration-document-template.md` as the structure: data reviewed, participants interviewed, one or more timelines, emerging themes (prioritized down to roughly the top two to five if there are more than a meeting can cover), specific feedback prompts, and a plain "known gaps" section for anything the earlier phases flagged as missing or unavailable. This document is a review draft for participants to react to, not a finished report -- its prompts should make it easy for someone to correct something, not defend a conclusion.

## Handing off the result

Present the finished Calibration Document as the deliverable, and be direct about the boundary: this skill doesn't run the calibration meeting itself and doesn't produce the final incident report. If the developer wants help with either of those next, that's a distinct task outside what these four Howie Guide pages define, and worth naming as such rather than quietly extending scope.
