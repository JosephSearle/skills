# Universal Spike Standards

Primary authorities: Kent Beck (_Extreme Programming Explained_, 2nd ed. 2004) | Ron Jeffries (_Extreme Programming Installed_, 2000) | Mike Cohn (_User Stories Applied_, 2004; Mountain Goat Software)

---

## 1. The Two Inviolable Constraints

Every spike, regardless of type or context, must honour both of these:

**Constraint 1: The timebox is the deliverable.**
A spike does not end when the answer is found. It ends when the timebox expires. The output is whatever the team learned within that time — nothing more. Beck: "A spike is the simplest possible program to explore potential solutions." The program is bounded by time, not by correctness or completeness.

**Constraint 2: The spike is throwaway by definition.**
Any code, prototype, or document produced during a spike is not a deliverable. It is evidence. It may be deleted the moment the team has extracted the learning from it. A spike that produces production-grade output is not a spike — it is an unplanned implementation. Jeffries: the spike's value is in what the team knows afterward, not in what it built during.

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

Mountain Goat Software: "A spike is an activity a team performs to get smarter about something." The key word is "smarter" — if the team is already smart enough to estimate and plan the work, a spike adds overhead without benefit.

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

## 6. Jeffries' Three-Phase Spike Execution Model

From _Extreme Programming Installed_, the spike executes in three phases:

1. **Scope** — Define the question precisely. A spike aimed at "learn about Redis" will wander. A spike aimed at "determine whether Redis pub/sub can deliver messages to 10k concurrent subscribers with under 50ms p99 latency on our current infrastructure" will focus.

2. **Timebox** — Set the hard stop before starting. Not "we'll see how it goes." The timebox is set first; the scope is chosen to fit within it, not the other way around.

3. **Share back** — The spike is not complete until the learning is communicated to the team. A spike whose findings live only in one engineer's head has failed. The spike document is the mechanism for sharing back.
