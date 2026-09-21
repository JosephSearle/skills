---
name: playbook
description: >-
  Creates and maintains incident-response playbooks and their live-incident cheat sheets for
  situations that need investigation, judgment, or coordination -- not a fixed known fix. Covers
  both security-incident playbooks (NIST SP 800-61 PICERL lifecycle: adversary may be present,
  containment/eradication focus) and general operational/availability playbooks (Atlassian-style
  detect-through-postmortem arc: service restoration, communication focus). Always distinguishes
  playbooks from runbooks -- a runbook is for a known problem with a known fix (restart this
  service, rotate this credential); if the user describes that kind of fixed, deterministic
  procedure, use the sibling runbook skill instead, or say so explicitly. Use this skill whenever
  the user asks for an incident response plan, a security incident response playbook, a major
  incident process, an on-call escalation guide for an ambiguous/multi-cause problem, incident
  roles and severity definitions, an incident cheat sheet, or wants to define what counts as a
  "major incident" for their team -- even if they just say "we need something for when things go
  wrong and nobody knows why" or "what do we do if we get breached."
summary: Writes incident-response playbooks and their live-incident cheat sheets for ambiguous situations needing investigation or judgment -- picks the right lineage (NIST PICERL for security incidents, Atlassian-style detect-through-postmortem for operational ones), pins down a severity scale and an explicit invocation boundary, and always produces a standalone one-page cheat sheet alongside the full document.
---

# Playbook

## The distinction this skill exists to enforce

A runbook is for a known problem with a known fix: the failure mode is understood, the remedy
is understood, and the job is just to write the fixed sequence down so nobody has to remember it
under pressure. A playbook is for the opposite situation: something is wrong, or might be wrong,
and the right response depends on what gets discovered along the way -- an ambiguous outage with
an unknown cause, a suspected compromise, anything where the next step is "investigate and decide"
rather than "run this command." If someone describes a known, deterministic fix ("engineers keep
having to manually restart X when Y happens"), that's a runbook, not a playbook -- point them at
the sibling runbook skill instead of forcing this structure onto it. The two skills exist
separately because conflating them produces bad documents in both directions: a runbook padded
with unneeded investigation prose that slows down a known fix, or a playbook that pretends to be
a fixed sequence and gives responders false confidence in a situation that actually needs
judgment.

## Step 1: Establish which lineage applies

Playbooks come from two distinct traditions that share a family resemblance but carry different
emphases. Getting this wrong doesn't just mean minor structural mismatch -- it means the finished
document leans on the wrong instincts for the situation it's meant to serve. Ask, or infer from
context, before drafting:

**Security-incident playbooks** follow the lifecycle defined in NIST SP 800-61 Rev. 2, commonly
shorthanded PICERL: **Preparation → Detection and Analysis → Containment, Eradication, and
Recovery → Post-Incident Activity**. (Those exact groupings matter -- "Containment, Eradication,
and Recovery" is one phase, not three.) This lineage exists because an adversary may still be
active: the emphasis is on containing damage and evicting whatever is causing it before you can
safely investigate root cause or restore normal operation. Use this lineage for anything involving
a suspected or confirmed compromise, unauthorized access, malware, data exfiltration, or similar
security events.

**General operational/availability playbooks** follow the pattern built around Google's SRE
practice and made concrete in Atlassian's incident handbook: detect the problem, open a
communication channel, assess what's actually happening, send an initial status update, escalate
and delegate to the right people, send follow-up updates as understanding develops, iterate
(review) toward a fix, resolve, and only then run the postmortem. There's no adversary here --
the premise is a service degraded or went down and needs to come back, so the emphasis sits on
communication and coordination rather than containment.

If it's genuinely unclear which applies (e.g., "a bunch of servers are behaving strangely and we
don't know if it's a bug or an intrusion"), ask the user directly, or draft a hybrid that opens
with the operational detect/assess/communicate rhythm but includes an explicit branch point: "if
at any stage evidence of malicious activity emerges, escalate to the security-incident lineage
below." Don't silently pick one and hope it fits -- naming the choice out loud is itself useful
information for the reader.

## Step 2: Pin down the severity scale and the major-incident threshold

Don't let "is this bad enough to need a playbook" stay an abstract judgment call -- anchor it to
a concrete severity number, the same way Atlassian does: SEV-1 (a customer-facing service is down
for all customers) and SEV-2 (down for a subset) are both classified as "major incident" and
require this playbook; anything less severe is normal runbook-level response. If the org already
has a severity scale, use it and ask specifically where the major-incident line falls on it. If
they don't have one yet, recommend PagerDuty's open SEV-1 through SEV-5 taxonomy as a sensible
default (SEV-1: critical, public notification and executive involvement; SEV-2: critical, many
customers affected; SEV-3: stability or minor issues needing immediate service-owner attention;
SEV-4: minor, doesn't block product use; SEV-5: cosmetic) and set the major-incident line at
SEV-1/SEV-2, consistent with the Atlassian convention above. For a security-incident playbook,
the equivalent line is usually framed by scope and confidence rather than customer impact --
see Step 4's invocation-boundary guidance.

## Step 3: Give it an explicit invocation boundary -- required, not optional

The single most important thing separating a playbook people actually trust from one they ignore
or misuse is precision about when it applies. CISA's federal cybersecurity playbooks are the
strongest real example of this: they state plainly that confirmed malicious activity where a
major incident has been declared, or hasn't yet been ruled out, is in scope -- lateral movement,
credential access, exfiltration, compromised admin accounts, multi-system intrusions. And they're
equally explicit about what's *not* in scope: an unintentional spill of classified information,
a phishing email someone clicked with no resulting compromise, commodity malware contained to one
machine. That second half matters as much as the first. A playbook that only says what triggers
it invites someone to invoke it reflexively at 3am for something that doesn't need this level of
response, or -- worse -- to talk themselves out of invoking it for something that does, because
the boundary was never drawn clearly enough to check against.

Write this as its own section, near the top of the document, before the roles or procedure. State
both directions explicitly: what counts, and what a reasonable person might mistake for counting
but doesn't. Ground it in the severity threshold from Step 2 wherever possible ("this playbook
applies at SEV-1/SEV-2; a SEV-3 degraded-performance issue should be handled via the relevant
runbook instead") plus lineage-specific scope language for security playbooks (confirmed or
not-yet-ruled-out malicious activity vs. unintentional/no-compromise events).

## Step 4: Draft the core structure

Once lineage, severity line, and invocation boundary are settled, build out the rest. Every
playbook, regardless of lineage, needs:

**Roles.** Who holds overall command and makes the call on what happens next (an Incident
Commander), who handles external and internal communication (a distinct role from the IC --
don't let one person try to both run the incident and draft customer updates), and who's actually
executing technical response. Keep these separated even on a small team, because the moment
someone is both making command decisions and typing an update to customers, one of those jobs
gets rushed.

**The phase-by-phase procedure**, using the lineage's actual phase names from Step 1 rather than
a generic paraphrase -- PICERL's four phases for security incidents, or the fuller
detect/raise/open-comms/assess/initial-comms/escalate/delegate/followup-comms/review/resolve
arc for operational incidents. Write each phase as guidance for reasoning through that stage
(what questions to ask, what to check, who to loop in) rather than a numbered command sequence --
that rigidity is what belongs in a runbook, not here.

**Communication templates or triggers.** When does an internal status update go out, to whom, and
in what channel; if the org has customer-facing incidents, when does external comms get involved
and what's the minimum a first customer-facing message needs to say (usually: what's affected,
that it's being worked on, and when the next update will come -- not a root-cause guess).

**The postmortem handoff.** A playbook that resolves the incident and stops has no feedback loop.
Point explicitly to a blameless postmortem process -- what triggers one (usually any SEV-1/SEV-2,
or any security incident regardless of severity), who owns writing it, and roughly how soon after
resolution it should happen. If the org doesn't have a postmortem process yet, say so and suggest
setting one up rather than silently skipping this section -- it's the difference between a
playbook that improves over time and one that repeats the same confusion every time it's used.

## Where the files go, and how they're named

Check the repo for an existing convention first -- a `docs/playbooks/` or `playbooks/` directory
already in use, a wiki, or a stated policy elsewhere (a CLAUDE.md/CONTRIBUTING.md note). If one
exists, follow it rather than introducing a second location or naming scheme.

If there's no existing convention, default to a single standard rather than inventing a new one per
document, sitting alongside the sibling runbook skill's `docs/runbooks/` convention:

- **Location**: `docs/playbooks/`, flat (no further nesting by team/service unless the repo already
  organizes docs that way).
- **Filenames**: a descriptive kebab-case slug of the subject, plus a `-cheat-sheet` suffix on the
  companion document -- `checkout-outage-playbook.md` and `checkout-outage-cheat-sheet.md`. Keeping
  both names anchored to the same subject slug is what makes it obvious at a glance that they're a
  pair, even sorted alphabetically among unrelated files in the same directory.

A consistent, predictable location and naming pattern matters for the same reason the invocation
boundary does: someone reaching for this document during a live incident shouldn't also have to
guess where it lives or which of several similarly-named files is the one meant for live use.

## Step 5: Produce two artifacts, not one

A full playbook is meant to be read once, in advance, by someone building understanding of the
process and the reasoning behind it -- that's everything from Steps 1-4. But nobody reads prose
during a live SEV-1 at 3am. So alongside the full playbook, always produce a second, genuinely
standalone document: a one-page cheat sheet built to be read *during* the incident by someone
who may never have read the full playbook at all.

The cheat sheet needs to stand on its own -- don't write it as "see the full playbook for details"
shorthand. It should fit on one page/screen and contain: the invocation boundary in one or two
lines (so someone can sanity-check they're in the right document), the role list with one-line
responsibilities, the phase sequence as short checklist items rather than prose, and the
communication cadence (who updates whom, how often). If useful, this is also the right place for
this org's specific paging/escalation contacts and channel names, since that's exactly the kind
of detail someone needs at their fingertips mid-incident and doesn't need to hunt for it in the
longer document.

Save both as separate files, clearly named and cross-referenced (the full playbook can point to
the cheat sheet as "print this" or "pin this," and the cheat sheet can point back to the full
playbook for anyone who wants the reasoning after the fact).

## Step 6: Validate before delivering

Before finishing, check the draft against these:

- Is it unambiguous which lineage this is, and does the phase sequence actually use that
  lineage's real structure rather than a blend that belongs to neither?
- Does the invocation boundary say both what's in scope and what's explicitly not, tied to a
  concrete severity line wherever possible?
- Are the IC, communications, and technical-response roles clearly separated?
- Does every phase read as investigation/decision guidance rather than a rigid numbered
  procedure -- if you catch yourself writing "Step 1: run X, Step 2: run Y" with no branching,
  double check this isn't actually a runbook in disguise?
- Is there a genuinely standalone one-page cheat sheet, not just a summary that leans on the
  full document?
- Does it end by pointing at a concrete postmortem/lessons-learned process rather than stopping
  at "resolved"?
- Were the files placed and named per the repo's existing convention if one exists, otherwise
  `docs/playbooks/<subject-slug>.md` and `docs/playbooks/<subject-slug>-cheat-sheet.md`?

If a request turns out, on reflection, to actually describe a known fix rather than a
judgment-call situation, say so plainly and suggest the runbook skill instead of stretching this
structure to cover it.
