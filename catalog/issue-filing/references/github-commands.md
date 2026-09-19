# Git & GitHub commands for issue filing

Three separate jobs need commands here: **checking for duplicates** (read-only, safe to run freely), **reading the repo's own conventions** (also read-only), and **actually creating or commenting on an issue** (posting to GitHub — never run without the user's explicit go-ahead, matching Step 7 in SKILL.md). Keep the read-only pass and the posting step mentally separate; don't chain a `gh issue create` onto the end of a duplicate search without a confirmation step in between.

Sub-issue, issue-type, and dependency support landed natively in `gh` CLI **2.94.0** (June 2026). If a command below fails with an "unknown flag" error, run `gh --version` — on an older CLI, use the REST API fallback given for each one rather than assuming the feature doesn't exist.

## Before using `gh` at all

```
gh auth status
```
If this fails — `gh` not installed, or not logged in — don't work around it by guessing at API calls or fabricating what a search would have found. Say plainly that you don't have `gh` access in this environment and ask the user to check for duplicates and confirm reproduction themselves (Step 1 in SKILL.md), rather than silently skipping the check.

## Step 1 — Checking for duplicates and open PRs (read-only, safe to run anytime)

### Search open and closed issues
```
gh issue list --search "<keywords>" --state all --limit 20
```
`--state all` is the important part — a bug reported against a version that's already been fixed and released can still be sitting there as a *closed* issue, and treating a closed match as irrelevant is exactly the stale-report mistake Step 1 warns about. Try more than one keyword combination (the exact error string, the affected command/feature, the user's own phrasing) before concluding nothing matches — a single failed search is not a thorough duplicate check.

### Search across the whole GitHub instance (useful for large orgs/monorepos, or when you're unsure which repo an issue belongs in)
```
gh search issues "<keywords>" --repo <owner>/<repo> --state open
gh search issues "<keywords>" --repo <owner>/<repo> --state closed
```

### Check for an open PR that might already fix it
```
gh pr list --search "<keywords>" --state open
```
A well-described bug with an open PR already attached is a different situation from a genuine gap — surface this to the user rather than drafting a new issue as if no one's touched it.

### Read a specific issue you found as a likely match
```
gh issue view <number> --json title,body,state,labels,comments
```
Use this to actually confirm the match (same trigger, same symptom) before telling the user it's a duplicate — a similar-sounding title isn't enough on its own.

### Confirm reproduction against the latest release (for bug reports specifically)
```
gh release list --limit 1
gh repo view --json defaultBranchRef
```
If the user's report doesn't mention a version, or mentions one that predates the latest release, this is the "does it still reproduce on current?" check from Step 1 — ask, don't assume either way.

## Reading the repo's own conventions (read-only)

### Check for existing issue templates to map into (Step 6)
```
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
cat .github/ISSUE_TEMPLATE/*.yml .github/ISSUE_TEMPLATE/*.md 2>/dev/null
```
No `gh` needed — these are just files in the checkout. If templates exist, match their actual field names/structure (see the sibling `issue-template` skill for how these are designed) rather than free-texting a generically-shaped issue.

### Check the repo's actual label scheme before suggesting labels (Step 5)
```
gh label list --limit 100
```
Suggest only labels that actually appear here. If this comes back empty, or `gh` isn't available, say so and suggest a label *type* ("a bug label, if one exists") rather than inventing a plausible-sounding label string — a fabricated label name is worse than none, since it either fails outright on `gh issue create --add-label` or gets silently dropped depending on the client.

## Creating or commenting on an issue (posting — confirm with the user first)

These are publish actions. Draft the title/body/metadata first using the process in SKILL.md, show it to the user per Step 7, and only run one of these once they've explicitly said to proceed.

### First-time creation
```
gh issue create --title "<title>" --body-file <path-to-body.md> --label "<label>"
```
Use `--body-file` rather than `--body "<inline text>"` for anything beyond a one-line body — it avoids shell-quoting problems with a multi-paragraph body. Write the drafted body to a temp file first, then point `--body-file` at it.

### Setting the issue type (bug vs. feature/task, if the repo uses GitHub's issue-type field)
```
gh issue create --title "<title>" --body-file <path> --type Bug
gh issue create --title "<title>" --body-file <path> --type Feature
```
Only set this if `gh issue list --json issueType` shows the repo actually uses issue types — otherwise this flag has nothing to attach to.

### Filing as a sub-issue of an existing parent (Step 5)
```
gh issue create --title "<title>" --body-file <path> --parent <parent-number>
```
Or, on an existing issue:
```
gh issue edit <number> --parent <parent-number>
gh issue edit <number> --remove-parent
```
**REST API fallback** (gh CLI < 2.94.0, or if the flags above 404):
```
gh api repos/<owner>/<repo>/issues/<parent-number>/sub_issues -X POST -f sub_issue_id=<child-issue-id>
```
Note this endpoint wants the child's numeric **issue ID** (from `gh issue view <number> --json id`), not its issue *number* — don't conflate the two.

### Setting blocked-by / blocking dependencies (Step 5 — this is also the INVEST "Independent" check made structural)
```
gh issue create --title "<title>" --body-file <path> --blocked-by <number>
gh issue edit <number> --add-blocked-by <blocker-number>
gh issue edit <number> --remove-blocked-by <blocker-number>
gh issue edit <number> --add-blocking <blocked-number>
gh issue edit <number> --remove-blocking <blocked-number>
```
Set this as a real structured relationship whenever Step 3b's Independent check (or anything else in the description) surfaced a genuine dependency — don't leave it as a sentence in the body that a triage tool can't see.

### Linking a related (non-duplicate, non-blocking) issue
No command needed — reference it as `#<number>` directly in the body text. GitHub auto-links it. Don't use `--blocked-by`/`--parent` for a merely-related issue; those flags assert a specific structural relationship that a "see also" link doesn't.

### Commenting on an existing issue instead of filing a new one (the Step 1 duplicate outcome)
```
gh issue comment <number> --body-file <path-to-comment.md>
```
This is the right action when Step 1 finds a real duplicate and the user wants their repro details added rather than a second issue opened.

### Applying labels to an existing issue
```
gh issue edit <number> --add-label "<label>"
```
Only for labels confirmed via `gh label list` above — don't invent one because it seems plausible.

### Opening it for the user to look at
```
gh issue view <number> --web
```
Useful as a final step so the user can eyeball the rendered result, including how the body/labels/relationships actually render, rather than trusting terminal output alone.

## A caution on skipping the draft-then-confirm step

Nothing in this file changes Step 7 of SKILL.md: draft, show, get explicit confirmation, *then* run a creation/comment/edit command. A user asking you to "just file it" is explicit confirmation for that one issue — it isn't a standing instruction to skip confirmation on issues you draft later in the same conversation.
