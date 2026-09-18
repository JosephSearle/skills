---
name: support
description: 'Generate, update, or audit a project''s SUPPORT.md -- the document that tells someone who is stuck where to actually go, as distinct from README.md (how to get started), CONTRIBUTING.md (how to get a code change accepted), SECURITY.md (how to report a vulnerability privately), and CODE_OF_CONDUCT.md (how to behave). Unlike those four files, SUPPORT.md has no dominant spec or widely-forked template -- GitHub''s own docs page for it is thin, with no template offered in the file-creation UI. What functions as convention comes from two real patterns: Kubernetes'' "channel router" style (short, sets a boundary that the issue tracker isn''t for support questions, then routes by channel) and Microsoft''s org-wide template, which branches on whether the project is backed by a paid/internal support organization or is purely community-supported. The core judgment call this skill makes is asking what''s actually different about this document from README.md and CONTRIBUTING.md, since the most common real-world failure is a SUPPORT.md that just restates the README''s getting-started section instead of doing its actual job: routing someone who''s stuck to the right channel for the kind of stuck they are. Triggers on: "create a SUPPORT.md", "add a support document", "where should people ask for help", "set up a help/support channel doc", "update our SUPPORT.md", "audit our SUPPORT.md", "does our SUPPORT.md actually help anyone", or any instruction to create, write, update, improve, or review a project''s support/help-routing document.'
summary: Generates, updates, or audits a project's SUPPORT.md as a triage router to the right channel, not a restated README.
---

# Support Document Generation Skill

SUPPORT.md answers one narrow question: *I'm stuck -- where do I actually go?* That's a different
job from every other community-health file. README.md tells you how to get started. CONTRIBUTING.md
tells you how to get a code change accepted. SECURITY.md tells you how to report a vulnerability
privately. CODE_OF_CONDUCT.md tells you how to behave. SUPPORT.md exists specifically to keep the
issue tracker from becoming an unstructured help desk -- its whole job is triage-by-redirect: get
someone who's stuck to the channel that fits the kind of stuck they are, before they file a
low-value issue or a duplicate question.

## Why this file is different from the other four, and why that matters

There's no Standard-Readme, no Contributor Covenant, no OpenSSF working group behind SUPPORT.md.
GitHub's own documentation page for it is the thinnest of the community-health-file docs -- it
describes where to put the file and what to consider, but doesn't hand you a template the way
CODE_OF_CONDUCT.md gets one in the file-creation UI. That's not a research gap; it reflects that
this file is genuinely less standardized across the ecosystem than the others, and it changes what
this skill should actually do: instead of leaning on a canonical template and filling in the blanks
(what most of the other community-health skills do), lean on the *function* of the document, which
is stable even though its shape isn't.

Because there's no template to fall back on, the single highest-value question to ask before
drafting anything isn't "which section headings go in this file" -- it's **"what's actually
different between this and our README/CONTRIBUTING?"** The single most common failure mode in real
SUPPORT.md files is that they just restate the README's "getting started" instructions with a new
filename. If the draft doesn't draw real boundaries -- usage question here, suspected bug there,
security issue somewhere else entirely -- it isn't earning its place as a separate document, and the
project would be better served folding a short "Getting Help" section into the README instead.

This skill has two modes: **generate/update** (produce or revise the file on disk) and **audit**
(report on gaps -- especially README duplication and dead/wrong channel links -- changing nothing).

- Words like "audit," "check," "review," "does this still work," "are these links still good" ->
  **Audit mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "generate," "add," "set up," "update" -> **Generate/Update mode**.
  Continue below.
- If ambiguous, ask once rather than guessing.

---

## Step 1 -- Find out what channels actually exist and who's really backing this

1. **Is this project internally/commercially supported, or purely community-supported?** This is
   Microsoft's own explicit fork, and it's a genuinely useful question outside Microsoft too: an
   internal platform-tooling repo where "support" means "which internal team or Slack channel owns
   this" is a completely different document from a public open-source project routing strangers to
   Stack Overflow. Ask this directly if it isn't obvious from context -- it changes almost
   everything else in the file.
2. **What real channels exist for questions?** Look for (and ask about, if not evident): a
   Discussions tab, a Slack/Discord community, a Stack Overflow tag, a mailing list, a forum. Only
   list channels that actually exist and are actually monitored -- a SUPPORT.md pointing at a dead
   Slack workspace or an unmonitored mailing list is actively worse than not naming a channel at
   all, since it wastes the time of someone who's already stuck.
3. **Does CONTRIBUTING.md or SECURITY.md already exist?** Read them if so. This document needs to
   draw a clean boundary against both: general usage questions don't belong in the issue tracker
   (CONTRIBUTING.md's territory) and vulnerability reports don't belong in a public support channel
   (SECURITY.md's territory) -- SUPPORT.md's job is to say so and route accordingly, not to
   duplicate either document's content.
4. **What does the README already say about getting help?** If it already has a "Getting Help" or
   "Questions?" section, read it. A SUPPORT.md that says the same thing in different words has no
   reason to exist as a separate file -- either this new document needs to add real triage logic
   the README doesn't have, or the honest recommendation is to keep the guidance in the README and
   skip a dedicated SUPPORT.md entirely. Say this plainly if it's the case; a project doesn't need
   every possible community-health file just because peer projects have one.
5. **What kinds of "stuck" does this project actually see a lot of?** If the user knows their issue
   tracker fills up with a particular kind of noise (installation questions, "how do I configure
   X," confusion with a similar-sounding project), that's worth naming specifically -- a generic
   "ask questions in Discussions" is weaker than "installation issues are almost always answered in
   the FAQ linked here; if you've checked that, ask in Discussions."

---

## Step 2 -- Pick a shape based on what Step 1 actually found

Two real patterns exist, and the choice should follow from what you found, not from a stylistic
preference:

- **The channel-router pattern (Kubernetes' model).** Short. Opens by stating plainly that the
  issue tracker isn't the right place for general support questions, then lists the real channels
  that are, each with a one-line note on what it's for (Stack Overflow for how-to questions, a
  Slack/Discord for real-time discussion, a forum for longer-form topics, docs for reference
  material). This is the right shape for the large majority of community-driven open-source
  projects -- it's honest about what the file is for (keeping the tracker clean) and doesn't
  pretend to be more than a router.
- **The internal/community fork (Microsoft's model).** Explicitly branches at the top: if this
  project is backed by a paid or internal support organization, say so and route to that intake
  path (a ticket system, an internal form, a named team); if not, fall through to the same
  channel-router content as above. Use this shape specifically when Step 1 revealed that the
  project has (or is adjacent to) an internal/commercial support org -- most individual open-source
  repos should skip this branch entirely rather than including an empty "if you have a support
  contract..." section that doesn't apply to anyone reading it.

Don't invent a third structure or pad either pattern with sections that don't route anyone
anywhere -- the whole value of this document is being scannable in a few seconds by someone who
just wants to know where to go next.

---

## Step 3 -- Draft, with real boundaries against README/CONTRIBUTING/SECURITY

Open with the boundary statement first -- this is the sentence that actually does the file's job:
something like "this repository's issue tracker is for bugs and feature requests, not general
support questions -- if you're stuck on how to use \<project>, here's where to ask instead." Only
after that boundary is stated does the channel list itself matter.

For each channel listed, say what kind of question it's for, not just its name -- "ask
implementation questions on the #help channel in our Discord" is more useful than a bare Discord
invite link. If the project already has a FAQ or troubleshooting doc, link it before the
channel list, since a real fraction of "stuck" questions are already answered somewhere findable.

Explicitly route away from this document where relevant:
- A suspected bug or feature request -> the issue tracker (per CONTRIBUTING.md, if it exists).
- A vulnerability -> SECURITY.md, never a public channel.
- Interpersonal conduct -> CODE_OF_CONDUCT.md.

Keep the document itself short. If a section is starting to explain *how* to use the project rather
than *where to ask about* using the project, that content belongs in the README or docs, not here --
this is the recurring mistake to watch for while drafting, not just while auditing.

---

## Step 4 -- Validate before writing

Before writing to disk, confirm:

- Every channel listed is one Step 1 actually confirmed exists (a live Discussions tab, a real
  Slack/Discord, an actual Stack Overflow tag with real traffic, a real mailing list) -- not one
  assumed to exist because it's common for projects like this one.
- The document doesn't restate content already in the README's getting-started or installation
  instructions -- if it's tempted to, that content should stay in the README instead.
- It clearly and explicitly routes bug reports, vulnerability reports, and conduct issues elsewhere
  rather than trying to handle all of them itself.
- If the internal/community fork (Step 2) was used, the internal-support branch actually applies to
  this project -- don't include it as boilerplate for a purely community-run repo.

## Step 5 -- Write to disk & post-write guidance

Write to `SUPPORT.md` in the repo root by default, matching wherever the project's other
community-health files already live if that's somewhere other than root. After writing, tell the
user plainly which channels the file points to and, importantly, name any channel you weren't able
to confirm is actually active -- this is a case where flagging an unconfirmed channel matters as
much as flagging an unconfirmed contact does in SECURITY.md or CODE_OF_CONDUCT.md, since the failure
mode is the same shape: a document sending someone to a dead end.

If Step 1 revealed that this project doesn't really need a dedicated SUPPORT.md (its README already
covers getting help adequately, and there's no meaningful triage logic to add), say so directly
instead of generating a thin, redundant file just because one was asked for.

---

## Audit Mode

Read the existing SUPPORT.md, plus README.md, CONTRIBUTING.md, and SECURITY.md if present, then
produce a report -- do not modify anything.

Check for, in priority order:

1. **Dead or wrong channels.** A linked Slack/Discord that no longer exists or has been abandoned, a
   mailing list that's gone quiet, a Stack Overflow tag with no recent activity, a broken link.
   This is the most damaging thing to find, for the same reason a stale SECURITY.md contact is
   damaging: it sends someone who's already stuck to a dead end and actively wastes their time.
2. **Duplication with README.md.** Check whether SUPPORT.md is substantively just restating the
   README's getting-started or installation content rather than doing triage. If so, call this out
   specifically as the file not earning its place as a separate document.
3. **Missing boundaries.** Does it fail to route bug reports to the issue tracker, vulnerabilities
   to SECURITY.md, or conduct issues to CODE_OF_CONDUCT.md? A SUPPORT.md that tries to handle
   everything itself, or that says nothing about where non-support issues belong, is a structural
   gap even if every listed channel works.
4. **Staleness relative to the internal/community fork.** If the file includes an
   internal-support-org branch, check whether that's still accurate for this project (or was ever
   accurate) -- and vice versa, if the project has since gained a formal support org but the file
   still reads as purely community-run.

Close with a prioritized list: dead/wrong channels first (these actively fail someone right now),
then README duplication, then missing boundaries, then fork-staleness. Don't rewrite the file
yourself in this mode -- offer to switch to generate/update mode if the user wants that.
