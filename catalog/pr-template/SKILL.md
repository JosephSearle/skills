---
name: pr-template
description: 'Generate, update, or audit a GitHub PULL_REQUEST_TEMPLATE.md or GitLab merge_request_templates/*.md -- the template that shapes what a pull/merge request description says, as distinct from pr-description (writing one specific PR''s title/description text) and the README/CONTRIBUTING/GOVERNANCE skills (which cover different files entirely). Before drafting, establishes three things: which tracker the repo uses (GitHub Issues'' closing keywords vs. Jira''s Smart Commits vs. neither -- this decides whether the ticket field is a hyperlink or a command needing exact placement), the project''s trust model (internal-trusted-committer repo needing a narrative-first template per Google''s CL-description philosophy, vs. an OSS/external-contributor repo needing classification and gating per Kubernetes'' model, vs. a shop wanting several selectable templates per GitLab''s per-type model), and whether anything downstream (a changelog bot, release-note generator, required-reviewer rule, CI gate) parses fields out of the template, which turns field names/headings into a contract rather than prose. Knows the exact, easy-to-get-wrong mechanics of GitHub closing keywords (only fire when the PR targets the repo''s default branch -- silently no-op otherwise) and Jira Smart Commits (a command language -- #comment/#time/#resolve -- that must appear in the title or commit message, not just anywhere in the description). Triggers on: "create a PR template", "set up our pull request template", "add a PULL_REQUEST_TEMPLATE", "write a merge request template for GitLab", "our PR template doesn''t link Jira tickets right", "audit our PR template", "does our PR template still make sense", "we need different PR templates for bugs vs features", or any instruction to create, write, update, improve, or review the template that pull/merge requests are opened against (not the content of one specific PR -- that''s a different skill).'
summary: Generates, updates, or audits a GitHub/GitLab PR or MR template, matched to the repo's tracker, trust model, and any downstream automation that parses it.
---

# PR/MR Template Generation Skill

A `PULL_REQUEST_TEMPLATE.md` (or a GitLab `merge_request_templates/*.md`) is the form a contributor
sees when they open a pull or merge request. This skill is about designing *that form* -- not about
writing the text of any one specific PR (that's a different job; if the user already has a diff and
wants help writing up its title/description, point them at the CL/PR-description skill instead of
this one).

## The one rule that matters more than any section list

Google's engineering practices guide makes a point that should shape every template this skill
produces: **a PR/CL description is a permanent engineering record, not a review-request form.** The
reviewer reads it once, today. Everyone else who reads it -- someone debugging a regression eight
months from now, someone writing a changelog, someone doing an archaeology dig on why a system works
the way it does -- reads it long after the review is over, and they're searching for *why*, not
*what*. The diff already shows what changed. A template that only elicits a change-type checkbox
and a one-line summary has thrown away the one thing a human bothered to write down that the code
can't say for itself.

So every template this skill generates should default toward eliciting context, not just
classification: why this change, what alternatives were considered and rejected, what tradeoffs were
made. And the first line of the description should be an imperative summary of what the change does
-- "Delete the legacy cache and replace it with Redis," not "Deleting the legacy cache" or "This PR
removes the legacy cache." That's Google's convention specifically because it reads correctly in a
`git log` one-liner and in a changelog, not just at the top of a review tool.

This skill has two modes: **generate/update** (produce or revise the template on disk) and **audit**
(report on problems with an existing template -- especially ticket-linking syntax that looks right
but silently doesn't fire -- changing nothing).

- Words like "audit," "check," "review," "is this still right," "our links aren't working" ->
  **Audit mode**. Jump to "Audit Mode" near the end. Do not edit the file.
- Words like "create," "write," "set up," "add," "generate," "update" -> **Generate/Update mode**.
  Continue below.

---

## Step 1 -- Three questions, before drafting anything

These three answers determine the template's shape more than any stylistic choice does. If the user
has already answered one of these earlier in the same conversation -- for instance because a sibling
skill (CONTRIBUTING.md or GOVERNANCE.md generation) already asked "is this a public/OSS project or an
internal team repo" -- reuse that answer instead of re-asking; it's the same underlying fact about
the project, not a PR-template-specific question. Likewise, if this skill establishes the answer
first, mention to the user that the same answer applies to those sibling skills so they don't have to
repeat themselves later.

1. **Which tracker does this repo use?**
   - **GitHub Issues**, using closing keywords (`Closes #10`, `Fixes org/repo#100`, `Resolves #10,
     resolves #123`) -- the linked-ticket field should be a plain issue reference.
   - **Jira**, using Smart Commits (`ITZ-1234 #comment ...`, `ITZ-1234 #resolve`) -- the linked-ticket
     field is a command, not a hyperlink, and needs to sit somewhere Jira's Smart Commit processor
     actually parses it (see Step 3).
   - **Neither / an internal tracker with no auto-linking** -- a plain reference field is fine; don't
     invent auto-closing behavior that doesn't exist.
   - Check `.github/`, existing issue templates, or CI config for signals before asking outright; if
     genuinely unclear, ask once.

2. **What's the project's trust model?** This is the same public/OSS-vs-internal fork used by the
   CONTRIBUTING.md and GOVERNANCE.md skills, applied here:
   - **Internal, trusted-committer repo.** Everyone opening a PR is already a known, trusted
     collaborator. Google's own engineering org runs this way internally -- the right template is
     narrative-first and lightly gated: a real summary, real context, minimal or no checkbox
     gauntlet, because the people using it don't need to be walked through a compliance checklist.
   - **OSS / external-contributor repo.** Contributors are unknown quantities showing up once. The
     right template classifies and gates: Kubernetes' template forces a `/kind` label via bot,
     requires an explicit yes/no on whether a user-facing release note is needed, and uses checkboxes
     precisely because it can't assume shared context with the person filling it in.
   - **Multiple templates by change type.** Some shops (GitLab's own docs describe this pattern
     directly) want a different template per kind of change -- a bug-fix template, a feature
     template, a docs-only template -- selectable when opening the MR/PR, rather than one template
     trying to serve every case. This is orthogonal to trusted-vs-external and can combine with
     either.
   - Don't default to the OSS/gated shape just because it looks more thorough -- an internal team
     forced through a Kubernetes-style checklist every time will route around the template, and an
     unguided external-contributor repo with only a narrative prompt will get descriptions with no
     usable context from people who don't know what "usable context" means for this project.

3. **Does anything downstream parse fields out of this template?** A changelog generator, a
   release-note bot, a required-reviewer rule triggered by a checkbox, a CI gate that greps for a
   specific heading -- any of these turns the template's field names and format from prose into a
   contract. If the answer is yes, treat exact heading text, exact yes/no phrasing, and field order as
   things that cannot be casually reworded later without breaking the automation reading them --
   flag this explicitly in Step 5 so the user knows which parts of the template are now load-bearing.
   If the answer is no (most repos), the template can be worded however reads best to a human.

If the user hasn't stated the trust model or tracker and nothing in the repo settles it (no
`.github/ISSUE_TEMPLATE`, no Jira project key visible anywhere, no CI config referencing one), ask
before drafting rather than guessing -- a template built on the wrong tracker assumption produces
ticket-linking instructions that don't work, which is worse than asking one question.

---

## Step 2 -- Pick a shape from what Step 1 found

- **Internal-trusted, narrative-first (Google's model).** Sections: an imperative-summary line, a
  "Why" / context section (the change's motivation, what happens if this isn't merged), an
  "Alternatives considered" prompt if relevant, a brief testing note, and a real but short
  ticket-reference field. Skip elaborate checkboxes -- they're friction for people who already know
  the norms, and Google's own guidance treats the description's prose as doing the real work.
- **OSS/external, classification + gating (Kubernetes' model).** Sections: a `/kind` classification
  (bug, feature, docs, cleanup -- whatever taxonomy the project uses, often enforced by a bot on
  submission), a description prompt that still asks for *why* and not just *what* (don't let
  classification replace narrative -- Kubernetes' own template still asks "What this PR does / why we
  need it"), an explicit yes/no gate on anything that has real consequences downstream (Kubernetes
  uses this for "does this need a release note," which feeds their changelog automation directly --
  a checkbox with real teeth, not decoration), and a real, working ticket-reference field.
- **Multiple templates by type (GitLab's model).** Instead of one file, several: e.g.
  `.gitlab/merge_request_templates/Bug.md`, `Feature.md`, `Docs.md`, each scoped tightly to that
  change type rather than trying to cover every case with optional sections. GitLab also supports
  auto-populated variables (like `%{all_commits}`) in these templates -- mention this if relevant, but
  don't rely on it being available outside GitLab.
- Don't blend an internal-trusted narrative template with a full OSS gating checklist just because
  both seem thorough -- match the shape to who's actually going to fill this out.

---

## Step 3 -- Get ticket-linking exactly right

This is the part most templates get subtly wrong, and it's worth being precise about, since a broken
link fails silently -- nobody gets an error, the issue just never closes.

- **GitHub closing keywords** (`Closes #10`, `Fixes org/repo#100`, `Resolves #10, resolves #123`):
  these only auto-close the linked issue **if the PR merges into the repository's default branch**.
  On any other target branch (a release branch, a long-lived `develop` branch that isn't the
  default), the keyword is silently ignored -- no error, no warning, no close, no link. If the repo
  you're building this template for doesn't merge feature work straight to its default branch, say so
  explicitly in the template (e.g. a one-line note: "Closing keywords only work against `main` --
  reference the issue number without a keyword if targeting another branch") rather than including
  the keyword syntax as if it always works.
- **Jira Smart Commits** (`ITZ-1234 #comment does the thing`, `ITZ-1234 #time 2d 4h`, `ITZ-1234
  #resolve`): this is a command language, not a link. `#comment` posts the given text back to the
  Jira ticket, `#time` logs work against it, `#resolve`/`#close` transitions its workflow state.
  Smart Commits are parsed from **commit messages** (and, depending on the integration, the PR
  title) -- putting `ITZ-1234` only in a free-text description field the integration doesn't scan
  means it never fires. Design the template's ticket field to sit in, or explicitly instruct the
  contributor to also put the key in, the PR title or first commit message -- wherever this repo's
  actual Jira integration reads from -- not just "somewhere in the description."
  - If you don't know which surface (PR title vs. commit message vs. both) this repo's Jira
    integration actually scans, say so and ask, or note it as a placeholder to confirm -- don't guess
    a syntax that looks plausible but wasn't verified against how this project's integration is
    configured.
- **Making the ticket reference actually required, not optional boilerplate.** Research on
  high-performing teams found they don't leave the ticket reference as a soft suggestion -- they
  either wire a CI check that rejects a PR/title without a matching ticket key, or they leave the
  template field with no example/placeholder default, so an empty or unedited field is visibly wrong
  rather than something that can slip through looking filled-in. If the user wants this enforced
  (rather than just requested), mention the CI-check option -- that's a repo-configuration change
  outside this file, but worth flagging as the actual mechanism that makes a reference "required"
  rather than merely templated.

---

## Step 4 -- Draft, then validate before writing

Draft with:
- First line = an imperative summary of the change (a template usually can't force this, but it
  should visibly prompt for it, e.g. a "## Summary" section labeled to invite one line, imperative
  mood, not a paragraph).
- A "why," not just a "what" -- context, motivation, alternatives considered, matching Step 2's shape.
- The ticket-linking mechanics from Step 3, matched to the actual tracker, with the default-branch or
  Smart-Commit-placement caveat included where relevant.
- Field names and structure matching Step 1's downstream-automation answer -- if something parses
  this template, don't casually rename a heading a bot depends on.

Before writing, confirm:
- The ticket-linking syntax shown will actually fire for this repo (right tracker, right placement,
  default-branch caveat included if the repo's merge target isn't the default branch).
- The template asks for *why*, not just a change-type checkbox, unless Step 1/2 genuinely calls for a
  gated OSS shape -- and even then, a why-prompt survives alongside the gates.
- If downstream automation was named in Step 1, the exact field names/headings/yes-no phrasing it
  depends on are present and unchanged from what was specified.
- The template doesn't duplicate CONTRIBUTING.md's general contribution process -- it's specifically
  the form shown when opening a PR/MR, not a restatement of how to submit one.

## Step 5 -- Write to disk & post-write guidance

- GitHub, single template: `.github/PULL_REQUEST_TEMPLATE.md` (also works at the repo root or in
  `docs/`, but `.github/` is the conventional location GitHub looks for automatically).
- GitHub, multiple templates: `.github/PULL_REQUEST_TEMPLATE/<name>.md`, selectable via a query
  parameter on PR creation -- mention this to the user since it's a less well-known mechanic than the
  single-file case.
- GitLab: `.gitlab/merge_request_templates/<Name>.md`, one file per template, selectable from a
  dropdown when creating the MR.

After writing, tell the user plainly which shape was used and why (e.g. "used the OSS/gated shape
since this is a public repo with external contributors, matching the same trust-model answer as your
CONTRIBUTING.md"), and flag anything conditional: a default-branch caveat that was added because this
repo doesn't merge to its default branch, a Jira placement note that needs confirming against the
actual integration config, or field names that are now load-bearing for downstream automation and
shouldn't be renamed casually later.

---

## Audit Mode

Read the existing template (and, if useful for cross-referencing, CONTRIBUTING.md, any CI config
referencing PR fields, and evidence of the tracker in use), then produce a report -- do not modify
anything.

Check for, in priority order:

1. **Ticket-linking syntax that looks right but silently doesn't fire.** A closing-keyword reference
   in a template for a repo that doesn't merge to its default branch. A Jira key placed only in a
   description field when the integration actually scans commit messages or the title. This is the
   most damaging class of problem specifically because it fails silently -- nobody sees an error, the
   issue just never closes or the Smart Commit never posts.
2. **Field-name or heading drift that would break downstream automation.** If a changelog bot,
   release-note generator, or CI gate is known to parse a specific heading or checkbox, check whether
   the current template still uses that exact text.
3. **A template that only classifies, never asks why.** A checkbox-only or label-only template with
   no prompt for context/motivation fails the core design principle this skill is built around --
   flag it even if nothing is technically broken.
4. **Structural mismatch for the project's actual trust model.** A heavy OSS-style gating checklist
   on a small internal-trusted-committer repo (friction contributors will route around), or a bare
   narrative-only template on a repo that now takes regular external contributions and needs
   classification/gating it doesn't have.
5. **Duplication with CONTRIBUTING.md.** Whether the template re-explains general contribution
   process instead of being the focused form shown at PR/MR creation time.

Close with a prioritized list: silently-broken linking first (these fail without anyone noticing),
then automation-breaking drift, then the why-vs-classification gap, then structural fit, then
duplication. Don't rewrite the file yourself in this mode -- offer to switch to generate/update mode
if the user wants that.
