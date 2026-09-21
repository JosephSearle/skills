# Universal Spike Standards

Primary authorities: Kent Beck (originator of the Spike Solution practice, via Ward Cunningham's contemporaneous account) | Ron Jeffries (co-founder of Extreme Programming; _Extreme Programming Installed_, 2000) | Mike Cohn (_User Stories Applied_, 2004; Mountain Goat Software)

Verification note (2026-09): the Cohn and Beck citations below are checked against live primary/official sources and linked in the Sources section at the end of this file. The "three-phase execution model" attributed to Jeffries could not be verified against a specific passage in his text — it is retained as a sound synthesis of XP spike practice, but is labelled as such rather than as a direct quote.

---

## 1. The Two Inviolable Constraints

Every spike, regardless of type or context, must honour both of these:

**Constraint 1: The timebox is the deliverable.**
A spike does not end when the answer is found. It ends when the timebox expires. The output is whatever the team learned within that time — nothing more. The common paraphrase of Beck's practice is that a spike is the simplest possible program to explore potential solutions [1]. The more directly attributable formulation, from Ward Cunningham's own account of coining the term with Beck, is Kent Beck's own line: "Spikes are good when you are knowledge-limited, not time-limited" [2]. Either way, the program is bounded by time, not by correctness or completeness.

**Constraint 2: The spike is throwaway by definition.**
Any code, prototype, or document produced during a spike is not a deliverable. It is evidence. It may be deleted the moment the team has extracted the learning from it. A spike that produces production-grade output is not a spike — it is an unplanned implementation. This follows directly from the XP framing above: the spike's value is in what the team knows afterward, not in what it built during.

---

## 2. Estimate the Spike by Bounding Time, Never Output

Cohn's formulation, which resolves the "you can't estimate an investigation" objection:

> A spike story is estimatable because its timebox makes it estimatable — not because its output is predictable.

The acceptance criterion for a spike is always temporal or observational, never deliverable:
- Valid: "We will have spent 3 days evaluating authentication libraries and documented our findings."
- Invalid: "We will have chosen and integrated an authentication library."

The second form describes an implementation story, not a spike. If the team cannot accept the result without a working output, the work is not a spike.

---

## 3. When to Create a Spike

Use a spike when the team cannot estimate a story because an unknown is too large. Specifically:

| Signal | Spike warranted? |
|---|---|
| Story cannot be estimated because a key technology is untested | Yes |
| The team is split on which of two approaches to take | Yes |
| A regulatory or compliance question blocks story design | Yes |
| A performance or scalability assumption has never been validated | Yes |
| An external API's behaviour is unknown or undocumented | Yes |
| A design decision has no obvious right answer | Yes |
| The team simply hasn't done this kind of work before | Yes — but cap the timebox tightly |
| A story is large but well-understood | No — split the story instead |
| A story is risky but the team can estimate it | No — accept the risk and track it |

Mike Cohn, Mountain Goat Software: "a spike is an activity a team performs to get smarter about something" [3]. The key word is "smarter" — if the team is already smart enough to estimate and plan the work, a spike adds overhead without benefit. Cohn is explicit that overuse is the most common mistake teams make with spikes, and that it should be reserved for *excess* uncertainty, not the ordinary uncertainty present in all work [3].

---

## 4. The Spike–Story Relationship

A spike is a precursor to a story, not a story itself. Its output is either:
1. **An estimate** — the team now knows enough to write and point a story
2. **A decision** — the team now has enough evidence to choose between options
3. **A scope boundary** — the team now knows what it does not know, enabling a follow-on spike

A spike never produces a feature. If the spike's output is production code that will be shipped, the work was not a spike.

**Backlog placement:** Spikes belong in the same iteration or sprint as the story they unblock — or at most one sprint ahead. Spikes scheduled indefinitely ahead of their stories become abandoned investigations. The team should never run a spike more than one sprint before the story it enables.

---

## 5. Spike vs Proof of Concept

These terms are often confused. The distinction matters for documentation:

| | Spike | Proof of Concept |
|---|---|---|
| Output | Learning | Working prototype |
| Throwaway? | Always | Sometimes |
| Enters production? | Never | Possibly |
| Bounded by | Time | Outcome |
| Documents | What the team learned | What the system does |

If there is any possibility the prototype will enter production, document it as a PoC, not a spike. A spike document that describes production-bound code will mislead anyone who reads it later.

---

## 6. Three-Phase Spike Execution Pattern

A synthesis of XP spike practice (attributed to Jeffries in earlier versions of this reference; retained here as sound guidance, but not verified against a specific passage of _Extreme Programming Installed_ — treat the three-phase framing as this skill's synthesis, not a direct citation). The spike executes in three phases:

1. **Scope** — Define the question precisely. A spike aimed at "learn about Redis" will wander. A spike aimed at "determine whether Redis pub/sub can deliver messages to 10k concurrent subscribers with under 50ms p99 latency on our current infrastructure" will focus.

2. **Timebox** — Set the hard stop before starting. Not "we'll see how it goes." The timebox is set first; the scope is chosen to fit within it, not the other way around.

3. **Share back** — The spike is not complete until the learning is communicated to the team. A spike whose findings live only in one engineer's head has failed. The spike document is the mechanism for sharing back.

---

## Sources

[1] Wikipedia, "Spike (software development)" — https://en.wikipedia.org/wiki/Spike_(software_development)
[2] Ward Cunningham, "Create a Spike Solution," c2.com XP wiki (Beck's own line, quoted by Cunningham) — https://c2.com/xp/SpikeSolution.html
[3] Mike Cohn, "Agile Spikes Deliver Knowledge So Teams Can Deliver Products," Mountain Goat Software — https://mountaingoatsoftware.com/blog/spikes (verified verbatim, checked 2026-09-21)

Not independently verified in this pass: the specific attribution of a "three-phase execution model" (Scope / Timebox / Share back) to Ron Jeffries' _Extreme Programming Installed_. No primary-source passage matching this framing was found; it is kept as skill-authored synthesis rather than a citation.
