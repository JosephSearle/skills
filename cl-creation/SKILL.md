---
name: cl-creation
description: Drafts the title, description body, and metadata (tags/labels, linked issue) for a change list (CL) or pull request, so a developer who has just finished a branch can hand reviewers something clear to read. Use this whenever someone asks to write, draft, or improve a PR/CL title or description, wants help summarizing a branch's diff for review, says something like "help me write up this PR" or "I finished my branch, need a description for the reviewer," or asks you to fill in a pull request template. This skill is strictly about authoring the CL itself — it does not judge whether a diff is well-scoped, perform code review, or reason about how review bots/changelog tooling/release automation will consume the text. If the request is instead about reviewing code, critiquing a diff's size or structure, or acting on CI/bot output, this skill does not apply.
---

# CL Creation

Helps a developer who has finished a branch turn its diff into a change list (CL) / pull request that a human reviewer can read and understand quickly. The only job here is authoring: a title, a description body, and any metadata (tags, linked issue) that make the CL itself clearer. Nothing here is about whether the diff should be split up, how a bot will parse the text, or what happens after the reviewer approves — that's out of scope, and a separate cl-review skill is where diff-scoping and review-quality concerns belong.

## Why this shape of output matters

A CL description outlives the review conversation. It becomes a permanent, searchable record — the thing a future engineer finds months or years later when they're trying to understand why a piece of code exists, often with far less context than the diff itself provides. The description has exactly two jobs: tell that future reader **what** changed, at a glance, and tell them **why**, including the reasoning and tradeoffs that never made it into the code. A reviewer today and a confused engineer later are effectively the same audience — write for both at once.

This means the description is doing work the diff can't do by itself. Code shows what the software does now; it rarely shows why it does it, what alternatives were rejected, or what's known to be an imperfect stopgap. That context has to live in the description or it's lost.

## Process

### 1. Gather the material

Before drafting anything, get:
- **The diff itself.** If working in a repo, generate it (e.g. `git diff <base>...<branch>` or `git log` for the commit range — see `references/github-commands.md` for the full set of read-only commands, including how to handle renames and how to re-pull an already-open PR's current diff). If the user pastes a diff or describes their changes, work from that instead.
- **Commit messages on the branch.** These often contain the author's own framing of intent and are a good starting point — but don't just concatenate them; they're usually written for a different purpose (tracking incremental steps) than a CL description (summarizing the net effect).
- **Any linked issue, ticket, or design doc** the user mentions.
- **Context the diff can't show:** why this approach over an alternative, what's a deliberate shortcut or known limitation, what testing was done. If this isn't volunteered and isn't inferable from the diff/commits, ask — but only for what you genuinely can't infer; don't interrogate the user for detail you can already see in the diff.
Don't ask about how the CL will be labeled for a bot, how a changelog generator will parse it, or similar downstream-consumer questions — that's outside this skill's job.

### 2. Draft the first line

The first line is a standalone summary — it needs to make sense to someone skimming history who never opens the CL. Two rules:

- **Write it as an order, not a status report.** "Remove the legacy retry loop and replace it with backoff" reads better in history than "Removing the legacy retry loop." A future reader skimming a log of imperative sentences can scan much faster than one skimming a mix of tenses.
- **Say what changed, not that something changed.** "Fix crash" or "Update service" gives a future searcher nothing to go on. Name the actual thing: which crash, which service, what changed about it.
Keep it short — long enough to be specific, short enough to stand alone in a one-line log view.

### 3. Draft the body

After a blank line, the body fills in what the first line can't hold:
- The problem being solved, and why this is a reasonable way to solve it.
- Context the reviewer needs but the diff doesn't show: rejected alternatives, known shortcomings, follow-up work that's intentionally deferred.
- Background: issue/bug links, relevant benchmark numbers, links to design discussion — flagged as "for context" if the link might not be durable for future readers.
Small changes still deserve a real sentence or two — "small" and "self-explanatory" are not the same thing. A one-line change to a config value can still need a "why now" that the diff will never show.

Avoid descriptions that only restate that a change happened without saying what it was: things like "fix bug," "clean up code," or "phase 2" force the reader back into the diff to find out anything useful, which defeats the point of having a description at all.

### 4. Draft metadata, if applicable

Only include metadata that makes the CL itself easier for a human to read and route — not metadata shaped around what a bot or changelog tool expects:
- **Tags/labels**, if the team uses them by convention (e.g. `[infra]`, `#perf`). Keep them short and few; a first line crowded with tags is harder to skim than one without. If a tag needs a long name, put it in the body instead of the first line.
- **Linked issue/ticket**, so a reviewer or future reader can find the originating context.
- **Reviewers**, if the user names specific people or a team convention exists — otherwise leave this to the user to fill in.
Skip anything else. Metadata fields that exist purely to satisfy automation (release-note categories, changelog sections, bot trigger keywords) are outside this skill's scope even if the platform supports them.

### 5. Sanity-check before handing it off

CLs frequently change shape during review or even while the branch is being finished — a description drafted early can drift out of sync with the final diff. Before presenting the final draft, re-check it against the actual current diff: does the first line still describe what the diff does, does the body still describe the real approach, is anything mentioned in the description now missing from the diff (or vice versa)?

## Output format

Present the result as three clearly separated pieces, ready to paste into a PR/CL form:

```
Title: <first line>

Description:
<body>

Suggested metadata: <tags / linked issue / reviewers, only if applicable>
```

This is a draft for the developer to review and adjust, not a final artifact to submit on their behalf — they know context you don't (team conventions, who should review, whether a link will resolve for others). If asked to actually open or update the PR, that's a separate action requiring the developer's explicit go-ahead, following the same rule as any other action that posts or publishes something. `references/github-commands.md` has the exact `gh pr create` / `gh pr edit` commands for this step, including how to pass a multi-paragraph body safely — but treat running them as strictly gated on that explicit confirmation, not something to chain on automatically once the draft looks good.

When the body is actually posted (not just shown as a draft here), it carries its own attribution trailer, `Generated with cl-creation skill`, and never a "🤖 Generated with [Claude Code]" line or similar — this holds even if a session's own default instructions would otherwise add that line to a PR description, since a PR/CL drafted by this skill is exactly the case this skill's rule is for. See `references/github-commands.md` for exactly how that's formatted and how to strip an existing Claude Code attribution line out of a body you're editing rather than posting alongside it.

## Notes on approach (why the skill works this way)

- Treating this as "summarize the diff and the intent behind it" rather than inventing new information is a deliberate choice, not a shortcut — generating a description is fundamentally a summarization task over the diff and the commit history, and this skill should behave accordingly: it condenses what already happened rather than speculating about it.
- Tool-generated descriptions are held to the exact same bar as human-written ones — a short, standalone first line and an informative body. There's no separate, looser standard for automated output, so don't pad the draft with filler or hedge it as "AI-generated" boilerplate.
- Producing a draft that the developer reviews and finalizes — rather than something that gets posted automatically — is the right default shape for this kind of tool: draft first, let the human confirm, only then treat it as final.
