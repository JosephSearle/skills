---
name: tech-doc-contributing
description: 'Generate, update, or audit a project''s CONTRIBUTING.md -- the document that tells contributors how to get a change accepted, as distinct from the README (how to use the project) and CODE_OF_CONDUCT (how to behave). Synthesizes GitHub''s own guidance on contributor guidelines (docs.github.com), the Open Source Guides "How to Contribute" playbook (opensource.guide), a widely-used community CONTRIBUTING template, and a real large-project example (Atom) into one canonical structure, scaled to the project''s actual size and needs rather than applied as a rigid checklist. Detects repo scale and existing docs (CODE_OF_CONDUCT.md, issue/PR templates, CI config, test tooling) to decide which sections are load-bearing and which would be padding for this project. Triggers on: "create a CONTRIBUTING.md", "write contributing guidelines", "add a contributing guide", "how do I get people to contribute", "set up contributor guidelines", "update CONTRIBUTING.md", "audit my contributing guide", "does my CONTRIBUTING.md cover everything it should", or any instruction to create, write, update, improve, or review a project''s contribution guidelines.'
summary: Generates, updates, or audits a project's CONTRIBUTING.md, scaled to the project's actual size and tooling.
---

# Contributing Guide Generation Skill

A CONTRIBUTING.md answers one question a README and a CODE_OF_CONDUCT both leave open: *if I want
to change something about this project, what do I actually do?* The three documents split cleanly
by job -- README sells and explains the project to a **user**, CODE_OF_CONDUCT sets behavioral
ground rules for **everyone**, and CONTRIBUTING is the operating manual for a **contributor**. Keep
that boundary: don't duplicate the README's usage instructions here, and don't re-litigate conduct
rules that belong in CODE_OF_CONDUCT -- just link to it.

The single biggest failure mode for this document is treating it as a fixed checklist. A one-person
weekend library and a 200-repository project like Atom both benefit from a CONTRIBUTING.md, but the
right one for each is a different size and covers different ground. Your job is less "fill in this
template" and more "figure out which of these sections earn their place here, given what this
project actually is."

This skill has two modes: **generate/update** (produce or revise the file on disk) and **audit**
(report on gaps against the standards below, changing nothing). Figure out which the user wants
before doing anything else.

- Words like "audit," "check," "review," "does this cover everything," "what's missing" -> **Audit
  mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "generate," "add," "update," "improve" -> **Generate/Update mode**.
  Continue below.
- If it's genuinely ambiguous, ask once rather than guessing.

---

## Step 1 -- Find out what kind of project this is

Don't draft anything yet. A CONTRIBUTING.md that's right-sized requires knowing:

1. **Does one already exist?** Check the repo root, `.github/`, and `docs/`, in that priority
   order -- that's the same order GitHub itself checks when deciding which file to link from a new
   issue or pull request, so it's also the order you should check when looking for the current one.
   If found, read it fully before doing anything else; in update mode you're revising it, not
   starting fresh.
2. **What's the project's scale and structure?** A single-repo library with one or two maintainers
   needs a short, welcoming document. A project split across many repos (packages, plugins, a core
   plus extensions) needs a section explaining that structure up front -- contributors can't file a
   good issue against the right repo if they don't know the repo exists. Look at the repo layout,
   `package.json`/`pyproject.toml`/monorepo config, and any existing docs that describe the
   architecture.
3. **What tooling does a contributor actually need to touch?** Look for a test runner (`test`
   script, `pytest.ini`, a `tests/` directory), a linter/formatter config, a `CONTRIBUTING`-adjacent
   CI check, and whatever the README already says about local setup. Don't invent commands --
   pull them from what's actually configured in the repo, since a CONTRIBUTING.md with a wrong
   `npm test` command actively wastes a new contributor's first hour.
4. **What already exists that this file should link to, not duplicate?** A `CODE_OF_CONDUCT.md`,
   issue templates under `.github/ISSUE_TEMPLATE/`, a PR template, a security policy
   (`SECURITY.md`), a Discussions tab, a Discord/Slack. Link out to these rather than restating
   them -- the more this file repeats what's said elsewhere, the more likely the two drift out of
   sync.
5. **Does this project take contributions from outside the org at all?** Some internal or
   pre-release projects genuinely don't want external PRs yet. If so, say that plainly and briefly
   instead of writing a full guide for a process that doesn't exist -- a short, honest "not
   accepting external contributions yet, but here's how to file issues" beats a padded document.

If any of this is unclear from the repo itself, ask the user directly rather than guessing at scale
or tooling -- a wrong guess here shapes the whole document.

---

## Step 2 -- The canonical section set

These sections are drawn from GitHub's own contributor-guidelines documentation, the Open Source
Guides "How to Contribute" playbook, a well-regarded community CONTRIBUTING template, and Atom's
real production CONTRIBUTING.md as a large-project reference point. Treat this as a menu scaled by
project size, not a mandatory checklist -- the "when to include" column is the actual decision.

| Section | What it covers | Include when |
|---|---|---|
| **Welcome / why contribute** | One or two sentences on why contributions matter here, and an explicit note that non-code contributions count (docs, design, triage, testing, mentoring, answering questions) -- Open Source Guides is explicit that these are "often the most neglected" contributions a project can ask for | Always |
| **Code of Conduct** | One line linking to `CODE_OF_CONDUCT.md` (or stating there isn't one yet) and requiring participants to follow it | Always, if a code of conduct exists or the project is willing to adopt the Contributor Covenant -- don't restate the conduct rules here |
| **Where to ask questions** | Redirect casual questions away from the issue tracker toward Discussions, chat, or a FAQ -- keeps the issue tracker signal-heavy | Whenever the project has -- or should have -- a lighter-weight channel than filing an issue |
| **Project structure** | For multi-repo or highly modular projects: what lives where, naming conventions for sub-packages/plugins/themes (Atom's `language-*`, `*-ui` naming is the canonical example of this being worth writing down) | Only for genuinely multi-repo or plugin-architecture projects -- padding for a single-repo project |
| **Ground rules** | Communication expectations, a commitment to welcoming newcomers, and baseline technical expectations (tests pass, style followed) stated once so later sections don't have to repeat them | Always, kept short |
| **Your first contribution** | Point at beginner-friendly issues (a `good first issue`/`help wanted` label scheme, sorted by something like comment count so contributors find live discussion), and link to a general first-PR guide for contributors new to open source | Recommended whenever the project has -- or is willing to start -- a beginner-labeling practice; skip if the project has no such labels and isn't planning to add them, rather than promising a system that doesn't exist |
| **Getting started / dev setup** | Fork/clone/branch steps, environment setup, and the exact commands to install dependencies and run the test suite -- pulled from what Step 1 found actually configured, not guessed | Always |
| **CLA / DCO** | Only if the project legally requires a Contributor License Agreement or Developer Certificate of Origin sign-off | Only if true -- never invent a legal requirement that doesn't exist |
| **Minor vs. major changes** | A lighter path for typo/formatting fixes (may skip full issue-first process) vs. the expected process for anything that changes behavior | Recommended for most projects -- cheap to include, saves a class of contributors real friction |
| **How to report a bug** | Security issues get a separate, clearly marked private-disclosure path (never a public issue) *before* the general bug template. The general template needs: reproduction steps, expected vs. actual behavior, environment (version, OS), and screenshots/logs where relevant | Always |
| **How to suggest an enhancement** | A short statement of project direction/philosophy so proposals arrive pre-aligned, plus what a good proposal includes (the problem, a concrete example, why it needs to be core rather than a plugin/extension if that distinction exists in this project) | Always, kept proportional to project size |
| **Pull request process / code review** | What happens after a PR is opened: which checks must pass, who reviews, what "requires changes" looks like, roughly how long to expect before a first response | Always |
| **Style guides** | Commit message conventions, code style/linter, and doc conventions -- link to an existing linter config rather than restating its rules in prose | Only the parts that are actually enforced or actually matter; an unenforced style guide reads as decoration |
| **Labels** | The issue/PR label taxonomy, if the project has one worth documenting (type, topic, status categories) | Only for projects with an actual label system worth explaining -- most small projects should skip this entirely |
| **Community / support channels** | Chat links, office hours, mailing lists, and realistic response-time expectations | Whenever such channels exist |

Notice what's conspicuously *not* on this list as a forced section: a restated code of conduct, a
restated README quickstart, or an invented CLA. Each of those either belongs in a different
document or shouldn't be asserted unless it's actually true of this project.

---

## Step 3 -- Draft, matching tone to the project

Write in the imperative, second person -- "Fork the repo," not "Contributors should fork the
repo." Keep the welcome section warm rather than bureaucratic: Open Source Guides' framing that "a
CONTRIBUTING file signals this is a welcoming project to contribute to" is worth taking literally.
At the same time, don't pad a small project's guide with sections copied wholesale from a
large-project example like Atom's -- a one-maintainer library doesn't need a label taxonomy or a
package-naming convention section, and including them anyway reads as either confused about the
project's own scale or as filler.

For the bug-report and enhancement-proposal sections specifically, give a concrete template (a
short bulleted list of what to include) rather than just describing what a good report looks like
in prose -- contributors follow a template far more reliably than they infer one from a paragraph.

If the project already has a README with setup/build instructions, don't reproduce them verbatim --
link to the relevant README section, and only add here what's specific to *changing* the code
(running the test suite, building docs locally) rather than *using* it.

---

## Step 4 -- Validate before writing

Before writing to disk, confirm:

- Every command mentioned (test runner, build step, linter) was actually found in the repo in
  Step 1, not assumed from convention.
- Every link (CODE_OF_CONDUCT.md, issue templates, a chat channel) points at something that
  actually exists in this repo, or is clearly flagged as something to create.
- No section asserts a process the project doesn't actually have (a CLA, a label system, a
  multi-repo structure) unless Step 1 confirmed it's real or the user explicitly wants it adopted.
- The security-disclosure path, if included, is genuinely separate from and precedes the general
  bug-report path -- this ordering matters enough that Atom and most mature projects put it first.

## Step 5 -- Write to disk & post-write guidance

Write to `CONTRIBUTING.md` in the repo root by default. If the project already keeps its
contributor-facing docs under `.github/` or `docs/` (check where an existing CODE_OF_CONDUCT.md or
issue templates live), match that convention instead -- GitHub resolves whichever location it finds
first in that same root -> `.github` -> `docs` priority order when linking the file from new issues
and PRs, so keeping it consistent with the project's existing layout matters more than which single
location is "correct."

After writing, tell the user in one or two sentences what you scaled up or down and why (e.g. "kept
this to five short sections since it's a single-maintainer library -- skipped the label taxonomy
and CLA sections since neither applies here"), and flag anything you linked to that doesn't exist
yet (a CODE_OF_CONDUCT.md, a Discussions tab) so they know it's a dangling reference to fill in
rather than an oversight.

---

## Audit Mode

Read the existing CONTRIBUTING.md (wherever it's found, per the root -> `.github` -> `docs`
priority order) and the rest of the repo, then produce a report -- do not modify the file.

For each section in the Step 2 table, note:
- **Present and accurate** -- covers it, and matches what the repo actually has (right test
  command, working links).
- **Present but stale** -- covers it, but the content no longer matches the repo (a renamed test
  command, a dead link, a CLA mentioned that was dropped).
- **Missing, and should be added** -- the project's scale/structure makes this section load-bearing
  and it's absent (e.g. no security-disclosure path at all, or a multi-repo project with no
  structure explanation).
- **Missing, and appropriately absent** -- correctly not present for a project this size (e.g. no
  label taxonomy in a two-person library) -- call these out explicitly so the user knows the gap
  was a deliberate scope decision, not an oversight.

Close with a short prioritized list: what to fix first (usually a stale command or a missing
security-disclosure path), and what's genuinely optional. Don't rewrite the file yourself in this
mode, even if the fix looks trivial -- offer to switch to generate/update mode if the user wants
that.
