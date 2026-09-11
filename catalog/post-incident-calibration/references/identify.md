# Identify

Source: https://howie-guide.pagerduty.com/identify/

## What this phase is for

Identify is the foundation everything else builds on: before you can analyze an incident, you need to know who was actually involved, what they were working on, and where the record of what happened even lives. Skipping straight to analysis without doing this first tends to produce a narrative built around whoever was loudest in the main channel, missing quieter contributors whose context turns out to matter later.

## Questions this phase answers

- Which teams were involved in the incident (not just who happened to post in the main channel)?
- How long has each participant been at the organization? (Tenure shapes how much institutional context to expect from them, and how much an interview needs to spend on background versus specifics.)
- Which individuals typically work together day to day, versus who was pulled in ad hoc?
- What systems were actually being worked on during the response?
- How long had staff been on-call for the affected systems at the time of the incident?

## Data this phase needs

- Chat transcripts from the incident response channel(s)
- An org chart, or equivalent knowledge of team structure and reporting lines
- Basic background on the individuals involved (role, team, tenure)
- Messages from related channels beyond the primary incident channel: user-facing channels, on-call channels, general company channels, and channels specific to the components involved

Incident data is very often scattered across more than one channel. Expect to need to scan the primary incident channel for participants and roles, then search adjacent channels using keywords or the incident/ticket number to catch context that didn't make it into the main thread.

## Data checklist before moving to Analyze

Before treating this phase as done, you should be able to answer (or explicitly flag as unknown):
- [ ] List of teams involved
- [ ] List of individual participants, with team and (if known) tenure
- [ ] Which participants were on-call at the time, and for how long
- [ ] Which systems/components were touched
- [ ] Where the raw incident record lives (which channel(s), which tickets)

If any of these are unknown and the information isn't something you can reasonably infer from what's already been shared, ask for it rather than guessing -- a wrong guess about who was involved doesn't just get corrected later, it can shape which participants get interviewed and whose perspective the whole review ends up missing.
