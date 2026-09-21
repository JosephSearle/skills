---
name: gh-issue-template
description: 'Generate, update, or audit GitHub issue templates -- both modern YAML issue forms (.github/ISSUE_TEMPLATE/*.yml, with dropdowns, checkboxes, and required fields) and legacy plain-Markdown templates (.github/ISSUE_TEMPLATE.md), plus the config.yml template chooser that controls whether freeform issues are still allowed. This is a companion skill to a separate pr-template skill and an existing README-standard skill -- scoped strictly to issue templates. Produces a small family of templates rather than one generic form, because a bug report and a feature request need genuinely different fields: bug reports need reproduction facts (grounded in Simon Tatham''s "How to Report Bugs Effectively" -- steps to reproduce, expected vs. actual behavior, environment/version, and a structural separation of observed fact from the reporter''s speculation about the cause), while feature requests need problem/motivation first, proposed solution second, alternatives considered third. Recommends YAML issue forms over legacy Markdown by default since they''re the more capable, current mechanism, matches template strictness to whether the repo is an internal/trusted-team repo or a public OSS repo fielding reports from strangers, and helps decide whether config.yml should set blank_issues_enabled: false to force every report through a template. Triggers on: "set up issue templates", "add a bug report template", "create a feature request template for GitHub", "convert our issue template to a YAML form", "should we allow blank issues", "our bug reports never have enough info to reproduce", "audit our issue templates", "does our ISSUE_TEMPLATE still make sense", or any instruction to create, write, update, improve, or review the templates GitHub shows when someone opens a new issue (not the PR/MR template -- that''s a different skill).'
summary: Generates, updates, or audits a family of GitHub issue templates (bug report, feature request, and others as needed), in YAML issue-form or legacy Markdown format, matched to the repo's trust model.
---

# GitHub Issue Template Generation Skill

GitHub issue templates are what a reporter sees before they've written a word -- the form shapes
whether what comes back is something a maintainer can act on, or a two-line "it's broken" that
starts a slow back-and-forth just to get the facts that should have been there from the start. This
skill is about designing that form -- or that small family of forms, since a bug report and a
feature request are asking for fundamentally different things and shouldn't share one template.

## The one rule that matters more than any field list

Simon Tatham's "How to Report Bugs Effectively" is the actual reasoning behind why good bug-report
templates ask what they ask -- not just GitHub's syntax docs, which describe the mechanism but not
the purpose. Tatham's central claim: **the purpose of a bug report is to let the maintainer see the
program fail** -- either by reproducing it themselves, or by being handed precise enough facts to
reconstruct the failure without reproducing it firsthand. Every field in a bug-report template should
trace back to that one goal, not to "what sections do bug reports conventionally have":

- **Steps to reproduce** exists so the maintainer can make it fail themselves -- the single most
  valuable thing a report can contain.
- **Expected vs. actual behavior** exists to separate the objective fact of what happened from the
  reporter's interpretation of what should have happened -- these get blended together constantly,
  and unblending them is often the fastest way to spot whether something is actually a bug or a
  misunderstanding.
- **Environment / version** is the single most commonly-omitted fact, and its absence is what most
  often turns a real, fixable bug into something a maintainer can't reproduce and has to bounce back
  asking for. Make it hard to skip.
- Tatham also stresses separating **fact** ("I was at the computer and this happened") from
  **speculation** ("I think the problem might be in the caching layer"). Both are useful, but blended
  together in one free-text box, a maintainer can't tell which parts are load-bearing and which are
  a guess. Give speculation its own optional field (e.g. "Possible cause"), separate from the
  required "What happened" field, so a report is legible even when the reporter's guess is wrong.

A feature-request template needs a **different backbone entirely** -- reusing the bug-report shape
for it (steps to reproduce? expected behavior?) makes no sense and produces a form nobody can
actually fill in honestly. The right order is: **problem/motivation first** (what can't you currently
do, and why does it matter -- this is the part that lets a maintainer evaluate whether the request is
worth solving at all, independent of any particular proposed fix), **proposed solution second** (what
you'd want it to do), **alternatives considered third** (what else you thought about and why it
doesn't work as well -- this single field does more to prevent a maintainer from having to point out
an obvious alternative than anything else in the form).

This skill has two modes: **generate/update** (produce or revise the templates on disk) and **audit**
(report on problems with existing templates, changing nothing).

- Words like "audit," "check," "review," "is this still right," "our bug reports never have enough
  info" -> **Audit mode**. Jump to "Audit Mode" near the end. Do not edit files.
- Words like "create," "write," "set up," "add," "generate," "update," "convert" -> **Generate/Update
  mode**. Continue below.

---

## Step 1 -- Four questions, before drafting anything

1. **Format: modern YAML issue forms, or legacy Markdown?** Default to recommending **issue forms**
   (`.github/ISSUE_TEMPLATE/*.yml`) -- they support required fields, dropdowns, and checkboxes that
   Markdown templates can't enforce, which directly serves Tatham's goal (a required "Steps to
   reproduce" field can't be silently skipped the way a Markdown heading can be left blank under).
   Stick with legacy Markdown (`.github/ISSUE_TEMPLATE.md` or `.github/ISSUE_TEMPLATE/*.md`) only if
   the repo has a specific reason to -- e.g. it already has a working legacy setup and isn't asking
   for a change, or the user explicitly prefers plain Markdown's lower ceremony for a very small/
   informal repo. Don't silently downgrade a request to convert legacy templates to forms, and don't
   force forms onto a repo that's happy with what it has and didn't ask to change it.
2. **Which templates does this repo actually need?** At minimum, separate **bug report** and
   **feature request** -- they are the two templates almost every repo needs and they must not share
   a skeleton (see above). Ask whether the repo also wants a **documentation issue** template (typo/
   missing-docs reports, usually lighter than a bug report) or a **question/support** template --
   but if the repo already has a SUPPORT.md or a "getting help" channel, point questions there instead
   of adding a template that duplicates it; a "question" issue template and a support doc solving the
   same problem is the same duplication the sibling pr-template and support skills warn against for
   their own files.
3. **Should blank (templateless) issues stay allowed?** GitHub's `config.yml` has a
   `blank_issues_enabled` setting -- `true` (default) lets someone open an issue with no template at
   all; `false` forces every issue through one of the defined templates. Setting it to `false`
   tightens signal quality (no more contentless "it's broken" issues slipping through unstructured)
   but adds friction for edge cases that don't fit any template (a security report someone should
   actually be sending privately, a genuine miscellaneous question). If the repo is public/OSS and
   getting a lot of low-signal blank issues, `false` is usually the right call once real templates
   exist to replace them; for a smaller or internal repo, leaving it `true` is often fine. Ask if it's
   not obvious, and explain the tradeoff rather than defaulting silently.
4. **What's the project's trust model?** The same public/OSS-vs-internal fork used by the
   CONTRIBUTING.md, GOVERNANCE.md, and pr-template skills -- if the user already answered this earlier
   in the conversation for one of those, reuse it here rather than re-asking; it's the same underlying
   fact about the project. If this skill establishes it first, mention that the same answer applies
   to those sibling skills too.
   - **Internal/trusted-team repo.** Reporters are colleagues who already share context. A lighter
     template is fine -- even a simple Markdown checklist can work, since you don't need to defend
     against a report with zero effort behind it the way an OSS maintainer does.
     - **OSS/public repo.** Reporters are unknown quantities who may show up once, with no shared
     context and no obligation to follow norms they were never told about. This is where issue forms'
     required fields earn their keep -- you can't rely on reporter goodwill the way you can
     internally, so make the fields that matter (repro steps, environment) structurally required, not
     just requested.

If the trust model or template scope isn't clear from the conversation or the repo (no existing
`.github/ISSUE_TEMPLATE`, ambiguous README), ask before drafting rather than guessing -- a template
built for the wrong trust model either over-polices colleagues or under-specifies what strangers need
to provide.

---

## Step 2 -- Draft the bug report template

Structure around Tatham's goal (let the maintainer see the program fail), not a generic checklist:

- **What happened** (required). The observed fact -- plain description of the failure. Keep this
  fact-only; speculation belongs in its own field below.
- **Steps to reproduce** (required for OSS/public repos; strongly encouraged for internal ones). Ask
  for a numbered sequence, not a paragraph -- numbered steps are what actually lets someone else
  follow them exactly.
- **Expected behavior** vs. **actual behavior** as separate fields (or a combined field that
  explicitly asks for both, if keeping the form short is the priority) -- this is the fact/
  interpretation split Tatham emphasizes, and it surfaces cases where the "bug" is actually a
  misunderstanding of intended behavior.
- **Environment / version** (required for OSS/public repos). Ask for exactly what's needed to
  reproduce -- software version, OS, browser, relevant config -- not a generic "environment" free-text
  box that people leave blank. Being specific about what to ask for is what makes this field actually
  get filled in.
- **Possible cause** (optional, clearly separate from "What happened"). This is where Tatham's fact-
  vs-speculation split becomes a real field: a reporter's guess about the root cause is genuinely
  useful, but only if a maintainer can tell it's a guess and not verified fact.
- For issue forms specifically, use `required: true` on at minimum "What happened" and (for OSS/
  public repos) "Steps to reproduce" and "Environment" -- this is the mechanism that actually
  prevents a report with the load-bearing fields empty, which a Markdown template's headings alone
  cannot enforce.

## Step 3 -- Draft the feature request template

A different backbone, not the bug-report skeleton with renamed headings:

- **Problem / motivation** (required). What can't you currently do, and why does it matter? This is
  the field that lets a maintainer evaluate whether the underlying need is worth addressing at all --
  independent of whatever specific solution the reporter has in mind. A request with a vivid,
  concrete problem statement and a mediocre proposed solution is far more useful than the reverse.
- **Proposed solution**. What the reporter would want to happen. Frame this as one possible answer to
  the problem above, not the only one.
- **Alternatives considered**. What else was considered and why it doesn't work as well (including
  existing workarounds). This single field does more to prevent a maintainer from immediately
  thinking of an obvious alternative the reporter didn't mention than anything else in the form, and
  it signals the reporter actually thought about the problem rather than requesting the first idea
  that came to mind.
- Don't add "Steps to reproduce" or "Expected vs. actual behavior" to this template -- there's nothing
  to reproduce yet, and forcing those fields onto a feature request either produces confused
  non-answers or trains reporters to write nonsense just to get past a required field.

## Step 4 -- Docs/question templates, if requested

- **Documentation issue**: What's wrong or missing, where (the specific page/section), and what it
  should say instead. Lighter than a bug report -- no environment/repro fields needed.
- **Question/support**: Only add this if the repo genuinely doesn't already have a better channel for
  it (check for an existing SUPPORT.md or a stated community channel first -- see Step 1, question 2).
  If one exists, point to it instead of adding a template that duplicates it.

## Step 5 -- The config.yml chooser

Write `.github/ISSUE_TEMPLATE/config.yml` alongside the templates:

```yaml
blank_issues_enabled: <true|false, per Step 1's answer>
contact_links:
  - name: <e.g. "Ask a question">
    url: <e.g. a Discussions link or SUPPORT.md's actual channel>
    about: <one line on when to use this instead of an issue>
```

Use `contact_links` to route people who don't have a bug or feature request (a question, a security
report) to the right place instead of a template that doesn't fit them -- especially valuable if
`blank_issues_enabled` is `false`, since contact_links become the only escape hatch for things that
genuinely aren't issues.

## Step 6 -- Validate before writing

- The bug-report and feature-request templates use genuinely different fields, not the same skeleton
  with renamed headings.
- Required fields on issue forms are set on the fields that are actually load-bearing for the
  project's trust model (more required fields for OSS/public repos fielding strangers; lighter for
  internal repos).
- "What happened" and "Possible cause" (or equivalent) are structurally separate fields, not one
  free-text box asking for both fact and speculation.
- If a question/support template was considered, it doesn't duplicate an existing SUPPORT.md or
  stated support channel.
- `config.yml`'s `blank_issues_enabled` setting matches what Step 1 established, and `contact_links`
  covers anything routed away from a template.

## Step 7 -- Write to disk & post-write guidance

- Issue forms: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`,
  etc., plus `.github/ISSUE_TEMPLATE/config.yml`.
- Legacy Markdown: `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`
  (or a single `.github/ISSUE_TEMPLATE.md` if the repo genuinely only wants one, though this reintroduces
  the bug-report/feature-request blending problem this skill exists to avoid -- flag that tradeoff if
  the user asks for a single combined file).

After writing, tell the user plainly which format and templates were chosen and why (e.g. "used YAML
issue forms with required fields since this is a public repo taking reports from people you don't
know"), and mention whether the same trust-model answer applies to the sibling pr-template/
CONTRIBUTING.md/GOVERNANCE.md skills so the user doesn't have to restate it there.

---

## Audit Mode

Read the existing templates and `config.yml`, then produce a report -- do not modify anything.

Check for, in priority order:

1. **A single template (or near-identical templates) doing bug reports and feature requests at once.**
   This is the most common structural problem -- it means neither job is done well, since the two
   need genuinely different fields. Flag it even if the shared template "technically works."
2. **Missing load-bearing fields on the bug-report template** -- no steps to reproduce, no environment/
   version field, or (worse) a single free-text box blending "what happened" with the reporter's
   theory about why. These are the fields whose absence is what actually causes unreproducible,
   back-and-forth-requiring reports, per Tatham's core argument.
3. **Fields that aren't structurally required when they should be**, for an OSS/public repo relying
   on strangers -- a Markdown template can only ask, an issue form can enforce. If the repo is public
   and using legacy Markdown with load-bearing fields reporters keep skipping, that's a concrete case
   for migrating to issue forms.
4. **A feature-request template reusing the bug-report skeleton** (asking for repro steps or
   "expected vs actual" on something that hasn't been built yet), or missing a "problem/motivation"
   field entirely in favor of jumping straight to "proposed solution."
5. **A question/support template duplicating an existing SUPPORT.md or stated support channel**, or
   `config.yml` missing `contact_links` for cases that don't fit any template while
   `blank_issues_enabled` is `false` (meaning there's currently no escape hatch at all for a genuine
   non-issue).

Close with a prioritized list: the bug/feature blending problem first (it undermines everything else),
then missing load-bearing fields, then enforcement gaps, then feature-request structure, then the
chooser/duplication issues. Don't rewrite the files yourself in this mode -- offer to switch to
generate/update mode if the user wants that.
