---
name: code-of-conduct
description: 'Generate, update, or audit a project''s CODE_OF_CONDUCT.md -- the document that sets behavioral standards for a community, as distinct from CONTRIBUTING.md (how to get a code change accepted) and SECURITY.md (how to report a vulnerability). Synthesizes GitHub''s own platform-level guidance (which explicitly warns to "consider carefully whether you are willing and able to enforce it" before adopting one), the Contributor Covenant (the dominant standard, used by 9 of the top 10 open-source projects), Django''s split-document pattern (code of conduct separated from a published enforcement manual), Rust''s deliberately terse two-section alternative, and an academic comparative study of the six major real-world codes of conduct. The core judgment call this skill makes -- before picking a template -- is confirming there is a real, named enforcement contact who exists and has agreed to the role, since an unfilled `[INSERT CONTACT METHOD]` placeholder or a copy-pasted enforcement section pointing at another project''s moderators is worse than no code of conduct at all. Triggers on: "create a CODE_OF_CONDUCT.md", "add a code of conduct", "set up community guidelines", "adopt the Contributor Covenant", "write behavioral standards for contributors", "update our code of conduct", "audit our code of conduct", "does our code of conduct still hold up", or any instruction to create, write, update, improve, or review a project''s code of conduct or community-standards document.'
summary: Generates, updates, or audits a project's CODE_OF_CONDUCT.md, built around a real enforcement contact rather than a filled-in template.
---

# Code of Conduct Generation Skill

A CODE_OF_CONDUCT.md answers a different question than the other community-health files: not
*how do I contribute code* (CONTRIBUTING.md) or *how do I report a vulnerability privately*
(SECURITY.md), but *how are people expected to treat each other here, and what happens if they
don't?* Keep the boundary clean -- this isn't the place for contribution mechanics or security
process, and if either of those documents exists, cross-reference this one rather than restating
its content.

## The one rule that matters more than any template choice

GitHub's own documentation says this before it says anything else about templates: "consider
carefully whether you are willing and able to enforce" a code of conduct before adopting one. That
warning is the load-bearing fact of this entire skill. A code of conduct is a promise to the
community that bad behavior has a real consequence and a real person handling it -- not a badge
that completes a "community profile" checklist. Which text you adopt (Contributor Covenant, a
terser alternative, a custom one) is a much smaller decision than whether the enforcement section
names someone who actually exists, has actually agreed to the role, and is actually reachable.

A CODE_OF_CONDUCT.md with `[INSERT CONTACT METHOD]` still in it, or one that names a contact who
left the project two years ago, is worse than having no file at all: it tells someone who's just
experienced bad behavior that help exists, and then the help doesn't answer. Never write to disk
with a placeholder still in the enforcement section -- stop and ask instead.

This skill has two modes: **generate/update** (produce or revise the file on disk) and **audit**
(report on gaps, unfilled placeholders, and stale contacts, changing nothing).

- Words like "audit," "check," "review," "does this still hold up," "is our contact still right"
  -> **Audit mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "generate," "add," "adopt," "set up," "update" -> **Generate/Update
  mode**. Continue below.
- If ambiguous, ask once rather than guessing.

---

## Step 1 -- Find the answer to the question that actually matters

Before picking any template text, establish:

1. **Who enforces this, and have they agreed to it?** This is the question to ask first, not last.
   If the user hasn't named a person, role, or small team, ask directly -- "who should reports of
   bad behavior actually go to?" -- rather than drafting around a placeholder and hoping it gets
   filled in later. If the answer is "nobody, really," say plainly that adopting a code of conduct
   without an enforcement path is exactly the mismatch GitHub's own guidance warns against, and
   offer the honest alternative: a short values statement with no formal enforcement claim, rather
   than a document promising a process that doesn't exist.
2. **Is an existing CODE_OF_CONDUCT.md, CONTRIBUTING.md, or SECURITY.md already in the repo?**
   Check the root first, then `.github/` and `docs/`. If a code of conduct exists, read it fully --
   in update/audit mode you're revising or checking it, not starting fresh. If CONTRIBUTING.md or
   SECURITY.md exist, note how they're structured so this document's tone and cross-references stay
   consistent with them rather than duplicating their content.
3. **Was this copied or adapted from another project's file?** If the user is starting from an
   existing project's CODE_OF_CONDUCT.md (their own past project, a template repo, something found
   on GitHub), check specifically whether its enforcement/contact section still points at the
   *other* project's moderators or maintainers. This is Rust's own explicit warning about its code
   of conduct: copying it wholesale implicitly claims Rust's moderation team will handle your
   reports, which isn't true and isn't fair to either community. Any inherited enforcement section
   must be stripped and rewritten for this project specifically -- never carried over silently.
4. **How large and how formal is this community?** A solo or small-team project, a mid-size project
   with regular external contributors, and a foundation-backed project with a governance structure
   are different cases. This shapes the structure decision in Step 2, not just the wording.
5. **Restorative or punitive framing, if the user has a preference?** The six major real-world
   codes of conduct differ noticeably in tone -- Mozilla's is more explanatory ("Be Inclusive" with
   reasoning), Google's and Rust's are terser and more directive. Neither is wrong; ask if the user
   has a preference, and default to the Contributor Covenant's tone (direct, non-legalistic) if they
   don't.

If the user hasn't already told you the answer to (1) and nothing in the repo settles it, ask
before drafting anything -- this is the one fact the rest of the document depends on.

---

## Step 2 -- Pick a structure: unified document, or code + separate enforcement manual

Two real, well-regarded structures exist, and they suit different project sizes:

- **Unified document (the Contributor Covenant model).** Standards and enforcement live in one
  file. This is right for the large majority of projects -- solo maintainers, small teams, and most
  mid-size open-source projects. It's simpler to maintain and there's only one file to keep
  current. Contributor Covenant is the default here specifically because of its adoption: 9 of the
  top 10 open-source projects use it, which means contributors arriving from other projects already
  recognize its structure and expectations.
- **Split document (the Django model).** Django deliberately separates the code of conduct itself
  (the values and standards, which rarely change) from a published enforcement manual (the actual
  procedural ladder -- e.g. a private warning, a 30-90 day suspension, an extended suspension, a
  permanent ban). This is worth proposing once a project has an actual moderation team or working
  group, because that group will want to revise its escalation procedure over time without
  reopening or re-ratifying the community's stated values every time. Don't propose this split for a
  small project -- it's two documents to maintain instead of one, and the benefit only shows up once
  there's a real team iterating on process.
- **Deliberately terse (the Rust model).** Two sections, no elaboration: a statement of expected
  conduct and a short statement of what happens when it's violated. This suits a project that wants
  a real, enforceable code of conduct without the length of the Contributor Covenant, but it still
  needs a real, named enforcement contact -- terseness is a length choice, not a way to avoid the
  Step 1 question.

Default to the unified Contributor Covenant model unless the user's answers in Step 1 point clearly
toward one of the alternatives (an active moderation team that wants to own its own escalation
process -> split; an explicit preference for something shorter and more direct -> terse).

---

## Step 3 -- Draft, filling in the enforcement section last and most carefully

Write the values/standards section first -- this is the part templates get closest to right
out of the box, and the Contributor Covenant's builder (contributor-covenant.org) can generate a
filled-in starting point if the user wants the canonical wording rather than a hand-adapted one.

Save the enforcement section for last, and treat it as the section that actually needs custom
information, not boilerplate:

- Name the real contact -- a person, a role alias (e.g. `conduct@project.org`), or a small named
  group -- that the user confirmed in Step 1. Never leave a bracketed placeholder in a file that's
  about to be written to disk.
- State what reporting actually looks like (where to send a report, and a brief note on
  confidentiality) without duplicating SECURITY.md's vulnerability-reporting process -- this is
  about interpersonal conduct, not security disclosure, and the two shouldn't be routed through the
  same document or the same inbox unless the user explicitly wants that.
- If using the split structure from Step 2, keep only a brief pointer to the enforcement manual
  here (e.g. "see ENFORCEMENT.md for how reports are handled") rather than duplicating the ladder in
  both places.
- If adapting text from another project's file (per Step 1, item 3), rewrite this section
  completely for this project -- don't leave a sentence that still describes someone else's
  moderators, response times, or escalation path.

---

## Step 4 -- Validate before writing

Before writing to disk, confirm:

- There is no bracketed placeholder anywhere in the file (`[INSERT ...]`, `[CONTACT]`, or similar) --
  search for it explicitly.
- The named enforcement contact is one the user actually confirmed, not one inferred or invented
  from a template.
- If this file was adapted from another project's code of conduct, its enforcement section no
  longer references that other project's team, process, or timelines.
- The file doesn't duplicate CONTRIBUTING.md's contribution mechanics or SECURITY.md's vulnerability
  reporting process -- cross-reference them by name instead if relevant.

## Step 5 -- Write to disk & post-write guidance

Write to `CODE_OF_CONDUCT.md` in the repo root by default, matching wherever the project's other
community-health files already live if that's somewhere other than root. If the split structure was
used, also write the enforcement manual (commonly `ENFORCEMENT.md` or similar -- ask the user's
preferred name) and make sure CODE_OF_CONDUCT.md links to it.

After writing, tell the user plainly who the file names as the enforcement contact and remind them
this is a real commitment, not a formality -- if that person or group's willingness to serve in the
role wasn't independently confirmed (as opposed to just being the person the user named), say so.

---

## Audit Mode

Read the existing CODE_OF_CONDUCT.md (and its enforcement manual, if the split structure is in use)
plus CONTRIBUTING.md and SECURITY.md if present, then produce a report -- do not modify anything.

Check for, in priority order:

1. **Unfilled placeholders.** Search explicitly for bracketed template text (`[INSERT ...]` and
   similar) left over from an unedited template. This is the single most damaging thing to find --
   it means the document has been sitting there presenting an option that doesn't work.
2. **A stale or unreachable enforcement contact.** An email address with a domain that doesn't match
   the project, a named individual no longer associated with the project (cross-check against
   CONTRIBUTING.md or README maintainer listings if present), or an enforcement section that clearly
   still describes a different project (a sign the file was copied and never adapted -- see Step 1,
   item 3, in generate mode).
3. **Duplication or conflict with CONTRIBUTING.md/SECURITY.md.** E.g. security vulnerabilities being
   routed through the conduct-reporting contact, or contribution mechanics repeated here instead of
   cross-referenced.
4. **Structural fit.** Whether a unified document is being strained by an unwritten but real
   escalation process (a sign the project may be ready for Django's split model), or, conversely,
   whether a split model is being maintained by a project too small to need it.

Close with a prioritized list: unfilled placeholders and unreachable contacts first (these are
what actually fail someone reporting an issue), then duplication/conflict, then structural
observations. Don't rewrite the file yourself in this mode -- offer to switch to generate/update
mode if the user wants that.
