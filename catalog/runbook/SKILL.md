---
name: runbook
description: >-
  Creates and maintains incident-response runbooks, playbooks, and on-call reference documentation
  for operational systems. Unlike most doc-generation skills, there's no fill-in-the-blank file
  format here -- the standardization is in process and structure. Enforces the distinction between
  a runbook (a known problem with a known fix -- a fixed, followable sequence) and a playbook (a
  situation needing investigation, judgment, or coordination -- guides triage rather than
  prescribing steps), since conflating the two is the most common failure in this doc type. Before
  drafting, establishes which of the two is being written, what severity/incident classification
  scheme is in use (defaults to recommending PagerDuty's open SEV-1 through SEV-5 taxonomy when
  none exists), who the actual reader is (someone who may not have written the code, possibly at
  3am, on a rotation without full context), and how it'll actually be discovered during a real
  incident (linked from alerting, an incident channel, an incident-management tool) rather than
  just existing in a repo. Also supports auditing and updating an existing runbook after an
  incident revealed it to be wrong or incomplete -- a runbook that goes stale gives false
  confidence, and fixing it is part of incident follow-up, not a separate task. Use this skill
  whenever the user mentions a runbook, playbook, on-call docs, incident response documentation,
  "what do we do when X happens," escalation procedures, or asks to write, create, update, or audit
  operational/incident documentation -- even if they call it something else, like a "wiki page" or
  "SOP." This is one of a family of doc-generation skills (README, CONTRIBUTING, SECURITY,
  CHANGELOG, CODEOWNERS, etc.), scoped specifically to runbook/playbook/on-call content rather than
  general technical documentation.
summary: Writes runbooks (known problem, known fix, fixed sequence) and playbooks (needs judgment, guides triage) for incident response and on-call work -- asks which one it's actually writing, what severity scale is in use, who the low-context 3am reader really is, and how the doc gets found during a real incident, plus an audit mode for fixing a runbook a real incident proved wrong.
---

# Runbook / Playbook Skill

This skill writes and maintains operational documentation used during incidents and on-call
rotations: runbooks, playbooks, and related reference material (severity definitions, escalation
paths, on-call handbooks). There's no universal file format for this doc type the way there is for
a CHANGELOG or a CODEOWNERS file -- the standardization that matters here is in process and
structure, established by Google's SRE practice and made concrete in tools like PagerDuty's
open-sourced incident response docs. This skill's job is to produce that structural pattern
correctly and check the result against it, not to fill in a static template.

## The distinction this skill exists to enforce

**Runbook**: for a known problem with a known fix. Disk is full, rotate this credential, clear this
queue, restart this service. The reader should be able to follow it top to bottom without stopping
to think, because it's a fixed, followable sequence.

**Playbook**: for a situation that needs investigation, judgment, or coordination -- "something is
degraded and we don't yet know why yet," "customers are reporting X but we haven't isolated the
cause." It guides triage and decision-making rather than prescribing a fixed sequence, because there
isn't one fixed sequence that covers it.

Conflating these is the single most common failure mode in this doc type, and it fails in both
directions: a runbook padded with decision trees and "it depends" branches becomes too slow to
follow under the exact pressure it exists for. A playbook written as a rigid numbered sequence gives
someone false confidence that following steps 1 through 7 will resolve a class of problem that
actually needs a human to think. **Before drafting anything, establish which one this is.** If the
user's description doesn't make it obvious (e.g., "we need docs for when the payment queue backs
up" could be either, depending on whether the cause is always the same), ask directly rather than
guessing -- the entire structure of what you write next depends on the answer.

## Step 1 -- Establish the four things before drafting

Don't skip to writing content. If the user's request already answers one of these, don't ask again
-- but don't assume an answer that wasn't given, either.

### 1a. Runbook or playbook?

Covered above. Get this settled first; everything else follows from it.

### 1b. What severity/incident classification scheme is in use?

Ask whether the org already has one. If they do, use their existing scale and terminology rather
than introducing a competing one. If they don't, default to recommending **PagerDuty's open SEV-1
through SEV-5 taxonomy** rather than inventing a new scheme from scratch:

- **SEV-1**: critical, actively impacting a large number of customers, warrants public notification
  and executive involvement.
- **SEV-2**: critical, actively impacting many customers' ability to use the product; notification
  pipeline severely impaired. (SEV-1 and SEV-2 both count as "major incidents" -- full response
  protocol, mandatory postmortem.)
- **SEV-3**: stability or minor customer-impacting issues needing immediate service-owner attention;
  partial functionality loss, not affecting most customers.
- **SEV-4**: minor issues requiring action but not affecting customers' ability to use the product
  (e.g., performance delays).
- **SEV-5**: cosmetic issues or bugs not affecting the ability to use the system.

This has become a de facto industry default specifically because PagerDuty open-sourced it, and
recommending it -- rather than a bespoke scale -- is what makes the runbook easier for someone from
another team, or someone new, to reference consistently without first learning a locally-invented
system. Only propose something custom if the user has a specific reason the five-tier scale doesn't
fit their org.

### 1c. Who is this actually written for?

The working assumption should be Google's SRE Workbook framing: the reader may not have written the
code they're now operating, may be reading this at 3am, and may be on a rotation that doesn't share
full context with whoever originally wrote the doc. Don't assume tribal knowledge -- a command, a
dashboard name, or a system behavior that's obvious to the author is not obvious to someone paged
awake with partial context. This is why Step 3's content structure insists on things like "how do
you know this applies" and "no assumed context" rather than treating them as optional nice-to-haves.

The SRE Workbook is candid that teams disagree on exactly how prescriptive to be here -- some
engineers prefer keeping entries general so they change slowly, others prefer step-by-step detail to
reduce variability and speed up resolution. There's no universally correct answer; ask the user
which their team leans toward if it's not obvious, since it affects how much detail Step 3's steps
should carry.

### 1d. How does discovery actually happen during a real incident?

A runbook that's technically correct but unfindable during an actual incident has failed at its
actual job -- "the file exists somewhere in the repo" is not the same as "the person paged at 3am
can get to it in ten seconds." Ask how this will actually be surfaced: linked directly from the
alert/page itself, referenced in an incident channel's pinned message, tagged in an incident-
management tool, or something else. If the user doesn't have an answer yet, say plainly that this is
worth deciding rather than leaving to chance -- the SRE Workbook's own guidance is that alerts should
link straight to the relevant playbook entry, not that someone should have to search for it while
the system is on fire. Note the answer in the doc itself if there's a natural place for it (e.g., "linked from the `high-queue-depth` PagerDuty alert").

### 1e. Where does the file itself live, and what's it named?

Check the repo for an existing convention first -- a `docs/runbooks/` or `runbooks/` directory
that's already in use, a wiki, or a stated policy elsewhere (e.g. a CLAUDE.md/CONTRIBUTING.md
note). If one exists, follow it rather than introducing a second location or naming scheme.

If there's no existing convention, default to a single standard rather than inventing a new one
per document:

- **Location**: `docs/runbooks/`, one file per runbook or playbook, flat (no further nesting by
  team/service unless the repo already organizes docs that way).
- **Filename**: a descriptive kebab-case slug of the subject only -- `add-a-skill.md`,
  `high-queue-depth.md`, `payment-webhook-failures.md`. Don't prefix the filename with `runbook-`
  or `playbook-` -- the directory already says what the file is, so the prefix is redundant on
  every single file in it. (If a project genuinely mixes runbooks and playbooks in one directory
  and wants the type visible at a glance, a suffix like `-playbook.md` on the handful that are
  playbooks is more useful than prefixing every file with `runbook-`, since runbooks are the
  common case here and playbooks are the exception worth flagging.)
- Once a project has adopted this convention (or its own), keep applying it consistently for
  every runbook/playbook in that repo -- don't let each new document introduce a fresh scheme.

## Step 2 -- Runbook mode: the fixed sequence

A runbook should read as a sequence someone can execute without stopping to make a judgment call.
Structure:

1. **Symptom / trigger** -- how do you know this runbook applies? The specific alert name, error
   message, dashboard state, or user report that should send someone here. Be concrete: "latency is
   high" is not a trigger; "the `p99-latency-checkout` alert has fired" is.
2. **Prerequisites** -- what access, credentials, or tools does the reader need before starting?
   Don't make someone discover mid-incident that they need a permission they don't have.
3. **The steps** -- numbered, unambiguous, no assumed context. Each step should be something the
   reader can execute without interpreting intent. Include the exact command, the exact dashboard
   name, the exact config key -- not a description of the kind of thing to do. If a step has an
   expected result, say what it is, so the reader knows whether it worked before moving to the next
   step.
4. **Rollback or escalation** -- what happens if the steps don't resolve it? A runbook that
   dead-ends after step 6 with no guidance leaves the reader stuck exactly when they most need
   direction. Name who to escalate to (a role or on-call rotation, not a specific person who might be
   asleep or off rotation) and what to hand them.
5. **Related links** -- the alert/dashboard this runbook responds to, related runbooks for adjacent
   symptoms, and the postmortem(s) that led to this runbook existing, if any.

Don't add decision branches ("if X, do A; if Y, do B") unless the branch itself is still a fixed,
knowable choice (e.g., "if the queue is on shard 1, run X; if shard 2, run Y"). A branch that
requires judgment about *which* branch applies means this isn't actually a runbook for that
scenario -- it's revealing that a playbook is needed instead, at least for that fork.

## Step 3 -- Playbook mode: guiding triage, not prescribing steps

A playbook should read as a decision aid for someone who needs to figure out what's actually
happening, not a script. Structure:

1. **Symptom / trigger** -- same as runbooks: how do you know this playbook applies. Playbook
   triggers are often broader ("elevated error rate across the API," rather than one specific alert)
   since the whole point is that the cause isn't known yet.
2. **Prerequisites** -- same idea as runbooks: access and tools needed to investigate, not to
   execute a fix (since the fix isn't known yet).
3. **Investigation guide** -- not numbered fixed steps, but a structured set of things to check and
   questions to answer: which dashboards to look at and what a normal vs. abnormal reading looks
   like, what to rule in or out first, what information to gather before deciding on an approach.
   This can be ordered (check the obvious things first) without being a rigid sequence -- the
   difference is that skipping or reordering items here doesn't break anything, whereas skipping a
   runbook step usually does.
4. **Decision points** -- where the investigation is likely to fork, and what each fork suggests
   about next steps (which may point to a specific runbook once the cause is identified, or to
   escalation/coordination if it's bigger than one person can resolve).
5. **Coordination** -- who needs to be looped in and when, especially for anything that looks like
   it could become a major incident. This is where the PagerDuty-style role structure (Incident
   Commander separate from whoever is actually diagnosing/fixing, a Comms/Liaison role for anything
   customer-facing) becomes relevant -- a playbook doesn't need to define these roles from scratch,
   but should point to wherever the org's incident-command process is documented, rather than
   silently assuming solo response.
6. **Related links** -- same as runbooks, plus links to any runbooks the investigation is likely to
   route into once a cause is found.

Don't turn a playbook into a runbook by numbering its investigation steps as though skipping one is
an error. The value of a playbook is precisely that it prepares someone to exercise judgment quickly
-- Google's own framing for this ("prioritize, prepare, practice") is that preparation exists so the
judgment call, when it's needed, is informed rather than improvised from nothing, not so the judgment
call is eliminated.

## Step 4 -- Audit / update mode

When the user wants an existing runbook or playbook reviewed or updated -- especially after a real
incident revealed it to be wrong, incomplete, or unfindable -- this isn't a separate skill, it's the
other half of this one's job. A runbook that goes stale is worse than none, because it gives false
confidence right up until someone follows it and it doesn't work.

Read the existing doc and ask what specifically went wrong during the incident that's prompting this
review (a step that didn't work, a symptom that didn't actually match, a dependency that's since
changed, a case the doc didn't anticipate at all). Then:

- If a step is simply wrong now (a command changed, a dashboard was renamed, a service was
  decommissioned), fix it directly and note in the update summary what changed and why, so anyone
  who used the old version recently knows to disregard it.
- If the incident revealed the doc was actually a playbook mis-structured as a runbook (or vice
  versa) -- e.g., the fixed sequence didn't apply because the real trigger had more than one possible
  cause -- restructure it per Step 2/3 rather than just patching the specific case that broke, since
  the next incident that hits this doc is likely to expose the same structural mismatch again.
- If the trigger/symptom section didn't actually match what happened (people found this doc too
  late, or found the wrong doc first), tighten the symptom description and check Step 1d's discovery
  question again -- a mismatched trigger is often really a discoverability problem in disguise.
- Treat this the way GitLab's own public postmortem practice treats it: the fix to the runbook is
  part of incident follow-up, filed and tracked like any other action item from the postmortem, not
  left as a vague intention to "clean it up later."

## Step 5 -- Validate before delivering

- Confirm runbook vs. playbook was actually decided (Step 1a) and that the structure matches the
  choice -- a runbook with judgment-call branches, or a playbook with a rigid numbered sequence, is a
  sign the wrong mode was used.
- Confirm the trigger/symptom section is specific enough that someone could tell, without prior
  context, whether this doc applies to what they're looking at.
- Confirm no step assumes access, tooling, or knowledge that wasn't listed in prerequisites.
- Confirm there's a rollback/escalation path (runbooks) or a coordination/escalation section
  (playbooks) -- neither should dead-end.
- Confirm the severity scheme referenced (if any) matches what the org actually uses, or that
  SEV-1..5 was proposed explicitly rather than assumed silently.
- Confirm related links point to real, specific things (an actual alert name, an actual dashboard,
  an actual related doc) rather than generic placeholders like "see monitoring."
- Confirm the file was placed and named per Step 1e -- the repo's existing convention if one
  exists, otherwise `docs/runbooks/<subject-slug>.md` with no `runbook-`/`playbook-` prefix.

## Step 6 -- Automation: what to recommend, and what not to build

**Recommend freely**: an alert auto-linking to its matching runbook/playbook (posting it into the
incident channel, or attaching it directly to the page) is a solved, low-risk pattern worth pointing
the user toward as a target integration if they don't already have it. This directly serves Step 1d
and is exactly the kind of "prepare in advance" investment Google's SRE practice recommends.

**Don't build or encourage by default**: an agent reading a runbook and live telemetry to *propose*
which step applies, or to execute infrastructure actions autonomously, is a meaningfully different
and more failure-prone capability than surfacing document text. This skill's own output should stay
scoped to producing clear, human-executable documentation. If the user asks about AI-driven incident
response on top of what this skill produces, treat that as a separate, deliberate decision for their
team to make -- don't draft runbook steps that assume an autonomous agent will execute them, and
don't default toward that direction unprompted.
