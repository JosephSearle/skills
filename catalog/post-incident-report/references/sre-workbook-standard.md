# Golden standard: Google SRE Workbook, "Postmortem Culture" (https://sre.google/workbook/postmortem-culture/)

The Howie Guide sets the *process* this skill's report comes out of (narrative,
multi-perspective, learning-focused). This chapter is the golden standard for
what makes the *document itself* rigorous and actually useful once it exists.
Where the two overlap (blamelessness, action items, organizational learning),
they agree -- use this file for the concrete mechanics Howie's Report page
leaves implicit: what header info to carry, how to quantify impact, how to
write a root cause that doesn't stop at the first plausible explanation, and
how to make action items survive contact with a backlog.

## Structural elements worth borrowing into the narrative report

Howie's report is narrative-first, not a form to fill in -- don't flatten it
into a rigid facts-template. But the SRE Workbook's structural elements are
worth weaving in as sections or clearly-labeled subsections within that
narrative, because they're what make a report actually useful to someone
scanning it six months later:

- **Header metadata**: a single named owner, who it's shared with, incident
  date, report publish date, status. Small, but it's what makes a report
  findable and accountable later.
- **Executive summary**: impact stated with real numbers where they exist,
  and the root cause in a sentence or two, before the narrative unfolds in
  full below it. Busy readers should get the shape of it in 30 seconds.
- **Impact, quantified**: "queries per second," "percentage of traffic,"
  "duration," "affected user count" -- not "significant" or "a lot of
  users." If the underlying data (from Identify/Analyze) doesn't have real
  numbers, say what's known and flag the rest as unquantified rather than
  inventing a figure.
- **Lessons learned, split three ways**: what went well, what went poorly,
  and where the team got lucky. That third bucket is easy to skip and is
  often the most important one -- a near-miss that worked out by luck is a
  gap that hasn't caused damage yet.
- **Action items, made to survive a backlog**: each one needs a single
  owner, a category (prevent / mitigate / detect / repair), a rough
  priority, and a concrete, verifiable completion condition -- "add
  rate-limiting to decommission operations" rather than "improve
  automation." Consolidate them into one list even though they may be
  discussed in multiple places in the narrative, per Howie's own guidance
  to give readers a single view.
- **Glossary / background for outside readers**: matches Howie's audience
  guidance directly -- define terms and give the historical/technical
  context a non-team reader needs.

## Root cause analysis: go past the first plausible explanation

The Workbook's core discipline: a root cause like "someone ran a command
manually" is a symptom, not a cause. Push toward the systemic gap underneath
it -- missing input validation, no idempotency check, an API that allowed an
ambiguous call, a safeguard that assumed a human would always double-check.
The test it offers is blunt and useful: "let's plan for a future where we're
all as stupid as we are today" -- meaning the fix should not depend on nobody
ever making that mistake again. When drafting the "contributing factors"
narrative, keep asking "why did the system allow this to happen" one layer
past wherever the data naturally stops, rather than settling for the first
answer that sounds sufficient.

## Blameless language, concretely

This is the same value the Howie process is built around from Identify
onward, but the Workbook gives concrete before/after phrasing worth applying
directly to report prose:

- Don't attribute blame to a named individual ("dylanfour@ ignored the
  alert" is out). Describe the system gap instead: "the alert routing did
  not escalate after N minutes of no acknowledgment."
- Avoid animated or judgmental language -- "careless," "ridiculous,"
  exclamation points, rhetorical questions about how something could have
  happened. Keep it factual and verifiable.
- "The team never wrote documentation" becomes "the turnup/turndown
  automation lacked sufficient safeguards" -- reframe absence-of-process
  statements as system-design gaps, not as a team failing to do something
  they should have known to do.

## Publishing discipline (informs the report's own internal deadlines, not this skill's job)

The Workbook stresses publishing while details are fresh -- ideally within
days, because delay degrades both accuracy and organizational trust that the
process is taken seriously. This skill doesn't control when a report gets
published, but it's worth surfacing to the user if a report is being drafted
long after the incident and after the meeting: note the gap plainly rather
than writing as if freshness weren't a factor, since faded memory in the
inputs (a meeting summary written from memory weeks later, e.g.) is itself a
data-quality gap worth flagging like any other.
