---
name: tech-doc-governance
description: 'Generate, update, or audit a project''s GOVERNANCE.md -- the document that answers who has authority to make which decisions, how someone gains or loses a role, and how disputes get resolved, as distinct from CONTRIBUTING.md (how to get a change accepted day to day) and CODE_OF_CONDUCT.md (how to behave). Synthesizes CNCF''s tiered governance templates (a Maintainer Council model for most projects, a Steering Committee/Elections model only for large multi-subproject projects), Scientific Python''s SPEC 9 (the closest thing to a real spec for this file type, stating the three questions any governance doc must answer: how roles are assigned and lost, how decisions are made and documented, how conflicts resolve), named governance models (BDFL, meritocracy, do-ocracy, consensus, maintainer council, steering committee), and the Kubernetes Steering Committee Charter as a real large-scale example. The core judgment call this skill makes before drafting anything is matching the document''s structure to how the project actually runs -- including recognizing purely internal/platform repos, which need a lightweight answer to the same three questions rather than a community-election template with bodies that don''t exist. Triggers on: "create a GOVERNANCE.md", "define our governance model", "who has authority to merge/decide here", "set up a maintainer council", "write a steering committee charter", "how do we resolve technical disputes", "update our GOVERNANCE.md", "audit our governance doc", "does our governance model still reflect how we operate", or any instruction to create, write, update, improve, or review a project''s governance or decision-making authority document.'
summary: Generates, updates, or audits a project's GOVERNANCE.md, matching its structure to the governance model the project actually runs, not to a template's ambition.
---

# Governance Document Generation Skill

GOVERNANCE.md answers a different question than the other community-health files: not *how do I
get a change accepted* (CONTRIBUTING.md) or *how do I behave* (CODE_OF_CONDUCT.md), but *who
actually has the authority to decide things here, and what happens when people disagree?* Per
Scientific Python's SPEC 9 -- the closest thing to a real specification for this file type -- a
governance document exists to answer exactly three questions:

1. How do people get roles (maintainer, committer, reviewer), and how do they lose them?
2. How do decisions actually get made, and how are they documented?
3. How do conflicts get resolved when people disagree?

Everything else in this skill is in service of answering those three questions honestly for the
project in front of you -- not filling in a template's section headings for their own sake.

## The one rule that matters more than any template choice

Unlike CONTRIBUTING.md or SECURITY.md, there's no single dominant template here -- and unlike
CODE_OF_CONDUCT.md, where one option (Contributor Covenant) wins by adoption, governance
templates are explicitly **tiered by structure**, not by wording. CNCF doesn't publish one
GOVERNANCE.md template; it publishes several, matched to how a project is actually organized: a
**Maintainer Council** model -- "the most basic formal governance... used by more projects than any
other" -- for projects where the people who review and merge code are the same people who make
governance decisions; and a **Steering Committee / Elections** model, reserved explicitly "for
very large open source projects with a complex structure often made up of multiple SIGs, Working
Groups, subprojects." Handing a small project the Steering Committee template produces a document
describing elected bodies, terms, and sub-groups that don't exist -- which actively misleads
contributors about who has real authority, exactly the failure mode this document exists to
prevent. The reverse mistake -- skipping the three core questions because a project feels "too
small to need governance written down" -- is just as bad: ambiguity about who decides things is
precisely what SPEC 9 says the document is for.

So: **before picking a shape, find out how the project is actually organized, and write for that,
not for how big the user wishes the project were or how official they want it to sound.**

This skill has two modes: **generate/update** (produce or revise the file on disk) and **audit**
(report on mismatches between the document and how the project actually runs, changing nothing).

- Words like "audit," "check," "review," "does this still reflect how we operate," "is this
  accurate" -> **Audit mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "generate," "define," "set up," "update" -> **Generate/Update
  mode**. Continue below.
- If ambiguous, ask once rather than guessing.

---

## Step 1 -- Find out how the project actually runs before choosing a shape

1. **Is this a public community project or an internal team/platform repo?** Ask this directly if
   it isn't obvious -- it's the single biggest fork in how this document should look. Almost all of
   the standard reference material (CNCF, Kubernetes, SPEC 9) is written for community-governed
   open-source projects with elected bodies, fixed terms, and public meetings. An internal platform
   repo maintained by one team doesn't need any of that machinery -- it needs a much lighter,
   direct answer to the same three SPEC 9 questions: who can approve what, how a disputed technical
   call actually gets resolved, and how someone becomes a maintainer of this specific repo. Don't
   apply community-project scaffolding (elections, terms, public meeting cadence) to an internal
   repo just because it's available -- that produces a document nobody will ever follow.
2. **Who currently has merge/approval authority, in practice?** Look at actual repo permissions,
   CODEOWNERS files, or who the user names as maintainers -- not aspirational titles. If the answer
   is "whoever wrote the code" or "one person, informally," that's a real answer (do-ocracy or a
   single-maintainer model), and the document should say so plainly rather than dressing it up as a
   council that doesn't meet.
3. **Does the project already have multiple sub-groups, working groups, or subprojects with their
   own leads?** This is the specific condition CNCF's Steering Committee model exists for. If there
   is only one group of maintainers making all decisions, that condition isn't met, regardless of
   the project's popularity or size in other respects (contributor count, stars, adoption).
4. **How do disputed technical decisions actually get resolved today, when they happen?** Ask for
   a real recent example if one exists. A vague "we discuss it and figure it out" is an honest
   description of consensus-seeking and should be written as exactly that; don't upgrade it to a
   formal voting procedure that has never actually been used.
5. **Does CONTRIBUTING.md already describe some of this?** Many CONTRIBUTING.md files already
   describe the PR review/merge process informally. Read it if it exists -- GOVERNANCE.md should
   describe *authority* (who decides, how someone gains/loses that authority, how disputes escalate
   beyond normal review) without re-explaining CONTRIBUTING.md's day-to-day mechanics.

If the user hasn't already told you the answers to (1) and (2) and nothing in the repo settles
them, ask before drafting -- misrepresenting who has authority is worse than a shorter document
that's accurate.

---

## Step 2 -- Pick a shape that matches what Step 1 found

Don't default to the most impressive-sounding option. Match the shape to the actual structure:

- **Single-maintainer or informal model.** One person (or a small, undifferentiated group) makes
  all decisions. The honest document here is short: who that is, how someone else could become a
  co-maintainer, and what happens if the maintainer becomes unavailable (a real, if uncomfortable,
  question worth answering plainly -- CNCF calls this a bus-factor / project-continuity question,
  and it's one of the most valuable things a short governance doc can actually settle). Don't
  invent committee structure to make this look more formal than it is.
- **Maintainer Council model (CNCF's most common, and the default for most projects with real
  governance needs).** The people who review and approve code also make governance decisions as a
  group -- this is the shape for a project with several maintainers of roughly equal standing and
  no separate governance layer. Cover: how someone becomes a maintainer, how a maintainer's status
  lapses (inactivity is the common real-world case, worth naming explicitly), how the council
  makes a decision (consensus-seeking with a documented fallback -- e.g., a vote -- for when
  consensus doesn't emerge), and how conflicts escalate if the council itself can't agree.
- **Steering Committee / Elections model (CNCF's model for large, multi-subproject projects
  only).** Use this only when Step 1 confirmed multiple sub-groups/subprojects/working groups
  already exist with their own leads, and the project needs a body above them to handle
  cross-cutting decisions. The Kubernetes Steering Committee Charter is the reference example here
  specifically because it's explicit about the split: what the committee can decide directly, and
  what's delegated to sub-groups (their SIGs) -- a governance doc at this scale that doesn't draw
  that line just recreates confusion about authority at a different layer. Includes real mechanics:
  member terms, an election process, and quorum/voting rules.
- **Internal/platform-repo model (not one of CNCF's tiers, but the common real case for
  internally-maintained tooling).** Skip the community-project machinery entirely -- no elections,
  no public meetings, no terms. Answer the three SPEC 9 questions directly and briefly: who can
  approve changes to this repo (a named team or role, e.g. "the Platform Data team"), how a
  disputed technical call gets resolved (e.g. "escalate to the team's tech lead" or "escalate to
  the engineering manager" -- name the real path), and how someone becomes a maintainer of this
  specific repo (e.g. "added by the current maintainers, typically after sustained contribution").
  This is usually a short document -- a page, not a charter -- and that's correct, not a shortcoming.

Don't blend tiers arbitrarily (e.g., a single-maintainer project with an "elections" section) --
each section of the document should describe a mechanism that's either real today or genuinely
planned and agreed to, not aspirational window-dressing.

---

## Step 3 -- Draft, answering the three questions directly rather than by section-heading habit

Structure the document around SPEC 9's three questions rather than reflexively copying a template's
headings verbatim, even when using a CNCF template as a starting point:

- **Roles: how they're gained and lost.** Name the actual roles this project uses (maintainer,
  reviewer, committer -- whatever terms the project already uses, don't introduce new ones without
  reason). Cover both directions: how someone becomes one (a real process, e.g. "nominated by an
  existing maintainer, approved by consensus"), and how someone stops being one (inactivity is the
  single most common real-world case and is worth naming explicitly rather than leaving it
  implicit -- an unaddressed "what if someone just disappears" question is a common source of real
  project dysfunction).
- **Decisions: how they're made and documented.** State the default decision-making mode honestly
  -- most real projects run on rough consensus most of the time, with a formal vote as a fallback
  for when consensus doesn't emerge, not as the everyday mechanism. Say where decisions get
  recorded (a governance-decisions log, meeting notes, or simply "in the relevant issue/PR" for a
  smaller project) so authority is traceable, not just asserted.
- **Conflicts: how they escalate and resolve.** Name the actual escalation path -- to the
  maintainer council, to a named individual, to a steering committee -- appropriate to the model
  chosen in Step 2. A document that describes roles and decisions but is silent on what happens
  when people genuinely can't agree hasn't actually answered the question this file exists for.

Keep the language plain and specific. "The project is governed by rough consensus" is a real,
useful sentence; a paragraph of governance-template boilerplate that never says who anyone actually
is isn't.

---

## Step 4 -- Validate before writing

Before writing to disk, confirm:

- The model chosen in Step 2 matches what Step 1 actually found -- no steering committee for a
  project with one group of maintainers, no elections that have never been run, no council that
  doesn't actually meet or decide things together.
- All three SPEC 9 questions (roles, decisions, conflicts) are answered concretely, not just
  gestured at.
- Named people, teams, or roles in the document are ones the user actually confirmed, not
  plausible-sounding placeholders.
- The document doesn't restate CONTRIBUTING.md's day-to-day PR/review mechanics -- it should cover
  authority and escalation, cross-referencing CONTRIBUTING.md for the routine process.

## Step 5 -- Write to disk & post-write guidance

Write to `GOVERNANCE.md` in the repo root by default, matching wherever the project's other
community-health files already live if that's somewhere other than root. After writing, tell the
user plainly which model was used and why (e.g. "used the Maintainer Council model since your three
maintainers already review and approve each other's merges as a group") and flag anything that was
described as aspirational rather than already-true (e.g. a fallback voting procedure that's never
actually been invoked) so the user can decide whether to keep it as a stated-but-untested process
or soften the language.

---

## Audit Mode

Read the existing GOVERNANCE.md, plus CONTRIBUTING.md and any CODEOWNERS/maintainer listing if
present, then produce a report -- do not modify anything.

Check for, in priority order:

1. **Mismatches between the document and reality.** Does the document describe a body (a steering
   committee, an elected council) that doesn't actually exist or hasn't met? Does it name people who
   are no longer maintainers, per CONTRIBUTING.md or a CODEOWNERS file? This is the most damaging
   class of problem -- a governance document that misrepresents who has authority actively misleads
   anyone who reads it to find out who to ask.
2. **Missing answers to the three SPEC 9 questions.** Does the document fail to say how someone
   loses a role (not just gains one)? Does it fail to say what happens when people disagree and
   normal review doesn't resolve it? A document that only covers roles and process but is silent on
   conflict resolution hasn't finished its job.
3. **Structural mismatch for project size.** A steering-committee/elections structure for a project
   with one small group of maintainers (over-engineered, describes bodies that will never form), or
   a project that has genuinely grown multiple subprojects/working groups but is still governed by
   an informal single-maintainer document that no longer reflects how decisions actually get made
   (under-specified for its current scale).
4. **Duplication with CONTRIBUTING.md.** Whether the document re-explains routine PR/review
   mechanics that already live in CONTRIBUTING.md instead of focusing on authority and escalation.

Close with a prioritized list: reality mismatches first (these actively mislead), then missing
answers to the three core questions, then structural fit, then duplication. Don't rewrite the file
yourself in this mode -- offer to switch to generate/update mode if the user wants that.
