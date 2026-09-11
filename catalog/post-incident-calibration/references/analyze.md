# Analyze

Source: https://howie-guide.pagerduty.com/analyze/

## What this phase is for

Analyze is where a general awareness of "an incident happened" turns into deep, specific knowledge of the event. It's iterative, not a single pass: you tag, build a timeline, take notes, and draft a narrative, and each of those makes the others sharper. Don't expect (or aim for) full comprehensiveness in one go -- how deep you go depends on how much time and data you actually have, and that's fine to say plainly rather than paper over.

## Core steps

1. **Tagging** -- Apply a consistent, organization-relevant set of tags to flag events of interest and group related information (e.g. by system, by theme, by responder). The goal at the start isn't exhaustive tagging; it's enough structure to start seeing patterns.
2. **Timeline creation** -- Build a visual/chronological account of events that captures more than "what happened when" -- include the false starts and red herrings responders chased, not just the events that turned out to matter. A timeline that only shows the tidy, correct path misrepresents how the incident actually felt to live through.
3. **Note-taking** -- Write down emerging questions as they come up, especially ones that need a specific participant to answer -- these become the seeds of the Interview phase.
4. **Narrative development** -- Reconstruct the event as it unfolded, preserving the complexity and confusion that were actually present, so the account is something people can learn from rather than a sanitized summary.
5. **Interviewee identification** -- Based on everything above, decide which participants need a deeper, individual conversation in the Interview phase.

## Guiding questions to work through

- What did responders think was happening at first, and who joined the response and when?
- What hypotheses were proposed, who proposed each one, and what evidence eventually proved or disproved it?
- Where did coordination work well, and where did communication break down?
- What actions were actually taken, and what was the stated (or inferred) reasoning behind them at the time?

## Data this phase needs

- ChatOps transcripts (from Identify)
- Alert logs
- On-call schedules
- Dashboards / monitoring data referenced during the incident
- System behavioral data (metrics, logs) from the incident window

## Data checklist before moving to Interview

- [ ] A timeline of events (even a rough one) covering the incident window
- [ ] At least a first-pass tag set or grouping of what happened, by system/theme/responder
- [ ] A running list of open questions that need a specific person to answer
- [ ] A short narrative draft of what happened, including the dead ends
- [ ] A shortlist of who should be interviewed and why (see references/interview.md for selection criteria)

If the underlying data (transcripts, alert logs, dashboards) isn't available, say so and ask for it or for whatever subset exists -- a timeline built purely from memory or assumption is exactly the kind of thing this phase exists to avoid producing.
