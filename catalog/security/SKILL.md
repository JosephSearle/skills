---
name: security
description: 'Generate, update, or audit a project''s SECURITY.md (and, where it has a public-facing site, a companion /.well-known/security.txt per RFC 9116) -- the document that tells a security researcher how to report a vulnerability privately, as distinct from CONTRIBUTING.md (how to get a code change accepted) and CODE_OF_CONDUCT.md (how to behave). Synthesizes GitHub''s own platform-level guidance on security policies, the OpenSSF oss-vulnerability-guide''s coordinated-vulnerability-disclosure (CVD) methodology, and two real production SECURITY.md files (Electron, OpenSSF Scorecard) as reference points. The core judgment call this skill makes -- before touching a section list -- is asking what the maintainers can actually commit to, since a stale supported-versions table or an unenforceable response-time promise is worse than omitting it. Triggers on: "create a SECURITY.md", "write a security policy", "add a vulnerability disclosure policy", "how do I let people report security issues", "set up responsible disclosure", "add security.txt", "update our SECURITY.md", "audit our security policy", "does our SECURITY.md cover what it should", or any instruction to create, write, update, improve, or review a project''s security/vulnerability-reporting policy.'
summary: Generates, updates, or audits a project's SECURITY.md (and optional security.txt), scaled to what maintainers can actually commit to.
---

# Security Policy Generation Skill

A SECURITY.md answers a narrower and higher-stakes question than CONTRIBUTING.md or CODE_OF_CONDUCT.md: *if I've found a vulnerability, who do I tell, privately, and what happens next?*
Keep the boundary clean -- this document is not where general bug reports go (that's
CONTRIBUTING.md's job), and it's not where behavioral expectations go (that's CODE_OF_CONDUCT.md's
job). If a CONTRIBUTING.md is also being written or already exists, it should point here for
security issues specifically and say nothing more about them -- see the `contributing` skill for
that side of the boundary.

## The one rule that matters more than any section list

Before deciding what goes in the file, find out what the maintainers will actually do, not what
would look good. A SECURITY.md is one of the few documents in a repo that outside researchers treat
as a promise: a supported-versions table that's actually out of date, or a "we respond within 48
hours" line nobody honors, is worse than not stating one at all -- it either gets a frustrated
researcher publicly disclosing early because the promised response never came, or it trains people
to distrust the file entirely. Real, well-regarded policies (OpenSSF's own Scorecard project among
them) routinely omit a supported-versions table or a hard SLA specifically because the maintainers
haven't committed to one. Ask "what can we actually commit to here?" before "what sections should
this have?" -- and when the honest answer is "we don't have a formal timeline," say that plainly
rather than inventing one.

This skill has two modes: **generate/update** (produce or revise the file on disk) and **audit**
(report on gaps and, specifically, on promises that don't match reality, changing nothing).

- Words like "audit," "check," "review," "is this accurate," "does this still hold up" -> **Audit
  mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "generate," "add," "update," "set up" -> **Generate/Update mode**.
  Continue below.
- If ambiguous, ask once rather than guessing.

---

## Step 1 -- Find out what's real before drafting anything

1. **Does a SECURITY.md already exist?** Check the repo root first (GitHub's own documentation
   points there), then `.github/` and `docs/` as it does for other community-health files. If
   found, read it fully -- in update mode you're revising it, not starting over.
2. **Is there a real reporting channel?** The strongest default is GitHub's built-in private
   vulnerability reporting (the repo's Security tab -> "Report a vulnerability"), since it's
   private by construction and needs no separate inbox to maintain. Check whether the repo has this
   enabled, or has a security contact email already referenced anywhere (a footer, an org profile,
   an existing draft). Don't invent an email address that doesn't exist anywhere in the project.
3. **Does the team have an actual support/maintenance policy?** Look for release branches, a
   changelog with an active LTS/maintenance line, or anything in the repo that shows which versions
   still get fixes. If nothing like that exists, a supported-versions table would be fiction --
   skip it, the same way Scorecard's own policy does.
4. **Will anyone actually commit to a response timeline?** If the user states one, use it verbatim
   and take it seriously -- OpenSSF Scorecard's own policy commits to 3 business days for an
   initial acknowledgment and 3 more for a detailed response, which is a real, specific, checkable
   promise. If the user hasn't said and nothing in the repo implies one, ask, rather than defaulting
   to a plausible-sounding number. "No fixed response time is guaranteed, but we treat reports
   seriously" is an honest and acceptable answer.
5. **What happens if the maintainer doesn't respond?** Electron's SECURITY.md is the reference
   example here: it gives reporters a concrete escalation path (their foundation's CNA) if there's
   no acknowledgment within a stated window, or no follow-through after acknowledgment. A project
   backed by a foundation or umbrella org that offers this kind of backstop should link it; a
   solo-maintainer project usually can't offer one, and shouldn't pretend to.
6. **Are there vulnerabilities that are explicitly someone else's job?** Electron's file explicitly
   routes third-party npm-module vulnerabilities to those modules' own maintainers rather than
   trying to own them. Any project with a plugin ecosystem or heavy third-party dependency surface
   should say the same thing -- it sets a boundary a researcher would otherwise reasonably assume
   the core project owns.
7. **Does this project have a public-facing website or API, separate from the repo?** If so, ask
   whether a companion `/.well-known/security.txt` is worth generating too -- see Step 3.

If the user hasn't already told you the answers to 2-4 and nothing in the repo settles them, ask
before drafting -- these are the load-bearing facts, not stylistic choices.

---

## Step 2 -- The canonical section set

Two layers of source material informed this list, and they pull in different directions on
purpose. GitHub's own guidance is deliberately minimal and platform-specific: supported versions,
and how to report. The OpenSSF oss-vulnerability-guide is the deeper layer -- a full
coordinated-vulnerability-disclosure (CVD) methodology, not just a template, with the operating
assumption that disclosure is a *process* with an embargo period, not a one-shot email. Where the
two disagree on emphasis, lean on OpenSSF's for anything beyond "who do I email."

| Section | What it covers | Include when |
|---|---|---|
| **How to report a vulnerability** | The single most important sentence in the file: the concrete, private channel (GitHub private vulnerability reporting preferred; otherwise a real, monitored security-contact email) | Always -- this is the one section that must not be vague or missing |
| **What to include in a report** | Description, reproduction steps, affected version(s), known mitigations -- concrete enough that a first report is actionable rather than round-tripping for basic details | Always, kept short |
| **Confidentiality / embargo expectation** | Ask reporters not to publicly disclose until a fix is available or a coordinated date is agreed -- the core premise of the CVD process the OpenSSF guide describes | Recommended for any project that wants time to actually fix things before disclosure |
| **Supported versions** | A table or short statement of which versions receive security fixes | Only if a real maintenance policy exists -- fictional or stale version tables actively mislead researchers about where to even test a finding |
| **Response timeline** | Concrete numbers for acknowledgment and follow-up, if the team will actually honor them | Only if real -- a vague or unenforced promise is worse than "no fixed timeline, but we take reports seriously" |
| **Escalation path** | What a reporter can do if they hear nothing -- Electron's foundation-CNA path is the model | Only for projects with an actual backstop (a foundation, an umbrella org, a second contact) -- most solo/small projects should omit this rather than invent one |
| **Third-party / dependency scope** | Explicitly routes vulnerabilities in dependencies, plugins, or bundled third-party code to their own maintainers | Recommended for any project with a plugin ecosystem or a lot of third-party surface |
| **Acknowledgments / credit** | Whether and how reporters get public credit for a responsibly disclosed finding | Optional -- only if the team actually intends to do this |
| **Out of scope** | What doesn't count as a security report here (e.g. issues already tracked as public bugs, denial-of-service via obviously-excessive load, social engineering of individual users) | Optional -- worth adding only if the project has actually been getting noise of this kind |

Notice what's deliberately not a forced section: a supported-versions table nobody maintains, a
response-time SLA nobody will honor, or an escalation path to a foundation that doesn't exist for
this project. Each of these is better left out than faked.

---

## Step 3 -- The machine-readable sibling: security.txt

RFC 9116 defines `security.txt`, served at `/.well-known/security.txt` on a web property (not
inside the git repo) -- it's a scanner-and-tooling-readable counterpart to SECURITY.md, not a
replacement for it. Only relevant if the project has its own public-facing site or API separate
from the repository itself (a docs site, a product domain, an API host) -- a library with no
website of its own has nowhere to put one.

If one is worth generating:
- **Contact** and **Expires** are the only mandatory fields. Contact should point at the same
  reporting channel as SECURITY.md (a `mailto:` or a URI). Expires is an RFC 3339 date-time no more
  than about a year out -- an expired `security.txt` is explicitly a signal to researchers and
  scanners that the file is stale, so treat setting this date as taking on a renewal commitment, not
  a one-time task. Flag this plainly to the user rather than silently picking a date.
- **Policy** should point back at the repo's SECURITY.md (or wherever the fuller policy lives) so
  the two documents stay in sync rather than drifting into two different stories.
- **Canonical**, **Acknowledgments**, **Preferred-Languages**, **Encryption**, and **Hiring** are
  all optional -- include only the ones that are actually true (e.g. don't add `Hiring` unless
  there's a real security-related job posting to link).

Don't generate a `security.txt` just because it's possible -- ask whether the project has a
qualifying public site first, and mention the annual-renewal commitment before writing the
`Expires` field.

---

## Step 4 -- Draft, matching honesty to confidence

Write in plain, direct language -- this document gets read by people evaluating whether to trust
the project with a real finding, so hedging or corporate throat-clearing reads as a bad sign.
State the reporting channel first, before anything else. If the team has no formal process yet
beyond "email us," say that plainly rather than padding it to look more mature than it is -- a
short, honest policy is more credible than a long one with invented specifics.

For "what to include in a report," give an actual short list, not a vague request for "details" --
contributors follow a template more reliably than they infer one from a sentence.

---

## Step 5 -- Validate before writing

Before writing to disk, confirm:

- The reporting channel actually exists and works (GitHub private vulnerability reporting is
  genuinely enabled for this repo, or the security-contact email is real and was found somewhere in
  the project, not invented).
- Every timeline and version claim was confirmed with the user or the repo in Step 1 -- nothing
  here should be a plausible-sounding guess.
- The escalation path, if included, points at a backstop that genuinely exists for this project.
- If a `security.txt` was generated, its `Expires` date and the renewal commitment it implies were
  called out to the user explicitly.

## Step 6 -- Write to disk & post-write guidance

Write to `SECURITY.md` in the repo root by default, matching wherever the project's other
community-health files (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`) already live if that's somewhere
other than root. After writing, tell the user in a sentence or two what was included and, more
importantly, what was deliberately left out and why (e.g. "left out a supported-versions table
since there's no active maintenance-branch policy in this repo -- worth adding once one exists").
If a `security.txt` was generated, remind them where it needs to be deployed (their web server's
`/.well-known/` path, not the git repo) and when its `Expires` date will need renewing.

---

## Audit Mode

Read the existing SECURITY.md (and, if relevant, `security.txt`) plus enough of the repo to check
its claims, then produce a report -- do not modify anything.

For each section in the Step 2 table, note whether it's present-and-accurate, present-but-stale (a
claim that no longer matches reality -- an expired support window, a dead contact email, a
response-time promise the team has stopped honoring), missing-and-should-be-added, or
missing-and-appropriately-absent for this project. The single most important thing to check, more
than section completeness, is whether any *existing* claim in the file is no longer true -- a
supported-versions table for a version line that's since been dropped, or a response-time promise
that isn't being kept, is a bigger problem than an absent optional section, since it's actively
misleading a researcher who trusts it. If a `security.txt` exists, check whether its `Expires` date
has already passed.

Close with a prioritized list: broken/misleading claims first (these actively erode trust), then
genuine structural gaps, then note what's correctly out of scope for this project's size. Don't
rewrite the file yourself in this mode -- offer to switch to generate/update mode if the user wants
that.
