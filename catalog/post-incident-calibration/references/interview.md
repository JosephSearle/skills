# Interview

Source: https://howie-guide.pagerduty.com/interview/

## What this phase is for

A lot of incident response happens off the record: in direct messages, face-to-face conversations, and in the heads of the people who lived through it. The Interview phase exists to surface that -- the reasoning, hesitation, and context that never made it into a chat transcript or a dashboard.

## Who to interview

Selection should draw on the shortlist from Analyze, but the Howie Guide highlights specific categories worth deliberately including:
- Key responders (e.g. whoever was incident commander or otherwise leading the response)
- People who might feel blamed for the incident -- their account matters and is easy to lose if they're not explicitly invited in
- Unexpected participants -- people who weren't on-call but ended up involved
- "Lone wolves" -- people with specialized knowledge that few others share
- System owners and subject-matter experts for the affected components
- Authors of code changes related to the incident
- New employees, who can sometimes surface assumptions that everyone more senior has stopped noticing

## Preparing

- Where possible, conduct interviews in pairs (one person leads, one takes notes) so nothing gets lost to the leader multitasking.
- Record with consent, or have a dedicated scribe if not.
- Plan for 20-60 minutes; treat 20 minutes as the practical minimum for a useful conversation.

## Opening the interview

Before diving into content: introduce yourself, explain why the investigation is happening, ask for consent to record, clarify how confidential the conversation will be treated, explain the broader context of the review, and confirm what the interviewee recalls about the incident.

Good opening questions:
- "How did you first get brought into the event?"
- "What was your understanding of the situation as you were pulled in?"
- "From your perspective, can you explain what happened?"

## Following up

From there, follow-ups should:
- Clarify specific terminology or statements the person made during the response
- Explore how they were notified and what dashboards or tools they were looking at
- Ask about their comfort level and expertise with the systems involved
- Surface anything that surprised them
- Walk through the sequence of events and the reasoning behind decisions as they were made in the moment, not with hindsight

## The talking ratio

Aim for roughly a 5:1 ratio of interviewee talking to interviewer talking. Your job is to extract what the responder knows, not to demonstrate your own understanding of the incident back at them.

## After the interview

- Clean up notes promptly and pull out emerging themes
- Flag anything left unanswered that needs a follow-up conversation
- Share notes with co-investigators, respecting anything the interviewee asked to keep confidential
- Send a same-day thank-you message
- Keep interviewees updated as the broader review progresses, so engagement doesn't fade before Calibrate

## How this skill actually conducts (or supports) interviews

This skill can't put itself on a call with a human responder, so it supports this phase in whichever of these shapes fits what's actually happening:
- **Generating an interview guide** -- a tailored set of opening and follow-up questions for a specific interviewee, built from what Analyze surfaced as needing their input. This is the default when no interview has happened yet.
- **Running a live, text-based interview** -- if the developer is relaying an interviewee's answers in real time (e.g. pasting responses as they come in during a call, or the interviewee is typing directly), ask the guide's questions one at a time, in the 5:1-ratio spirit, and take structured notes as answers arrive.
- **Synthesizing existing notes/transcripts** -- if interviews already happened and notes or a recording transcript exist, organize them into the themes and follow-up questions Calibrate needs, rather than re-deriving from scratch.

## Data checklist before moving to Calibrate

- [ ] Interview guide(s) prepared for each shortlisted interviewee, or
- [ ] Notes/transcripts from interviews already conducted
- [ ] Emerging themes pulled from those notes
- [ ] Any unanswered questions flagged for a follow-up

If no interviews have happened yet and none are planned, say so plainly -- Calibrate depends on this phase's input, and a calibration document written without any interview material is missing exactly the kind of context (the "what was in people's heads") that this phase exists to capture.
