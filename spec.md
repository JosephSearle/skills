# Spec: Skills Catalog Frontend

Status: Draft for engineering review
Source: `intent.md` (planning stage)
Repo: `skills` (JosephSearle/skills)

## 1. Summary

Add a read-only, card-based web catalog for the skills already living in this
repo, deployed on Vercel. A visitor (currently just Joseph) can see every
skill as a card on a browse page, open a skill to read its full `SKILL.md`
content, and download any skill as a standalone `.skill` file. The catalog is
generated from the repo's own skill folders at build time — no runtime
filesystem access, no database, no auth.

This spec resolves the open questions left in `intent.md` and calls out
places where the plan as written ran into real constraints. Section 9
(Areas of Concern) is required reading before implementation starts. Three of
the six items there were not "nice to knows" — they were points where the
intent as written could not be satisfied exactly as described, or where a
default needed explicit confirmation — and all three are now resolved:
§9.1 (the `description`/`summary` conflict) has a structural fix, backfilled
into both existing skills, not a workaround; §9.2 (the `.skill` format) has
Joseph's sign-off to proceed as specified; §9.6 (public hosting) is confirmed
as the intended behavior, not a gap. Nothing in this spec is blocking
engineering start.

## 2. Current state of the repo

```
skills/
├── .git/
├── .gitignore                  # ignores .claude
├── README.md                   # placeholder
├── cl-creation/
│   ├── SKILL.md
│   └── references/github-commands.md
├── conventional-commits/
│   ├── SKILL.md
│   ├── evals/evals.json
│   ├── references/git-commands.md
│   └── scripts/validate_commit_message.py
└── Claude outputs/              # ad-hoc eval report, not a skill
    └── conventional-commits-eval-review.html
```

- `.claude/skills/` is a gitignored, local mirror of the same skill folders
  used by Claude Code/Cowork on Joseph's machine. It is not committed and is
  out of scope per `intent.md` — confirmed here as a hard exclusion (§3.1).
- The repo has no `package.json`, no CI, and no build tooling today. Everything
  in it is hand-authored content. This is the first time application code
  will live alongside the skill content, which is itself a design
  consideration (§9.3).
- The repo's working convention is Conventional Commits + PR review (per its
  own `conventional-commits` and `cl-creation` skills). The frontend work
  should be built and merged the same way — feature branch, conventional
  commits, PR description via `cl-creation`.

## 3. Scope

### 3.1 In scope (per intent.md, resolved)

- A browse page (`/`) rendering every skill as a card: name, a human-scannable
  summary, and a Download button.
- A skill detail page (`/skills/[slug]`) rendering the full `SKILL.md` body
  and linking its reference files.
- A `.skill` download for every skill, available from both the card and the
  detail page.
- A build-time generator that scans the repo's top-level skill folders and
  produces the data the frontend consumes — no runtime parsing of `SKILL.md`.
- URL slug = skill folder name (`cl-creation` → `/skills/cl-creation`).
- Scales to new skills with zero frontend code changes — adding a folder and
  redeploying is sufficient.
- **Skill discovery rule (new, needed to make the above concrete):** a
  top-level directory counts as a skill if and only if it directly contains a
  `SKILL.md` file. This is an inclusion rule, not an exclusion list — it
  naturally skips `Claude outputs/`, `.git/`, `.gitignore`, `README.md`, and
  the new `site/` app directory (§4.1) without needing to name them.
  `.claude/skills/` is separately and permanently excluded regardless of this
  rule (§3.2) — it is gitignored today, so a build running from the actual
  git history never sees it, but the rule is stated explicitly so it survives
  even if that ever changes.

### 3.2 Explicitly out of scope

- Editing or authoring skills through the UI.
- Search, filtering, tagging.
- Surfacing eval results, scripts, or usage stats as browsable content (they
  still travel inside the `.skill` archive, per §5.2 — just not rendered).
- Skills from any other repo or plugin (agentcraft, milvus-*, etc.).
- `.claude/skills/` in any form — not scanned, not indexed, not a fallback
  data source if the top-level folder is ever missing.
- Auth / access control on the catalog itself — confirmed out of scope, not
  provisionally: the catalog is intentionally fully public, matching the
  public `skills` repo it's built from (§9.6).

## 4. Architecture

### 4.1 Repo layout

Recommendation: keep the frontend **in this repo**, under a new top-level
`site/` directory, rather than splitting into a second repo.

```
skills/
├── cl-creation/                 # unchanged
├── conventional-commits/        # unchanged
├── intent.md
├── spec.md
└── site/                        # new
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── scripts/
    │   └── build-skills-index.mjs   # the generator (§5)
    ├── app/
    │   ├── page.tsx                 # browse page
    │   └── skills/[slug]/page.tsx   # detail page
    ├── generated/                   # gitignored, build output
    │   └── skills-index.json
    └── public/
        └── downloads/                # gitignored, build output
            └── <slug>.skill
```

Rationale: the intent was framed as "surfacing the skills *in this project*,"
and a single repo keeps the frontend automatically in sync with skill
content — no cross-repo dependency, no submodule, no second place to update
when a skill changes. The trade-off (frontend churn landing in the same repo
as hand-authored skill content) is real and is discussed in §9.3, but on
balance keeping it in-repo is the better default. Vercel's project settings
can point at `site/` as the project root so unrelated skill-content commits
don't need to trigger a rebuild unless `site/` or a skill folder changed
(configure Vercel's "Ignored Build Step" accordingly).

### 4.2 Data flow

```
skill folders (SKILL.md, references/, scripts/, evals/)
        │
        ▼
scripts/build-skills-index.mjs   (Node, runs as a prebuild step)
        │
        ├──▶ site/generated/skills-index.json   (metadata, §5.1)
        └──▶ site/public/downloads/<slug>.skill  (archives, §5.2)
        │
        ▼
Next.js static generation (generateStaticParams + build-time reads
of skills-index.json)
        │
        ▼
Vercel: fully static output, no server runtime needed
```

Both generated outputs are build artifacts, not source. **Neither is
committed to git** — this resolves the "committed to the repo or produced
fresh on each Vercel build" question left open in `intent.md`. Reasons:
a JSON index and a set of zip archives are derived, binary-adjacent content
that would show up as noisy diffs on every skill edit, in a repo whose whole
current value is a clean, readable git history of hand-authored skill files.
They're regenerated identically by CI/Vercel and by a local `npm run build`,
so there's nothing to gain from committing them and real cost (diff noise,
merge conflicts on a generated file) in doing so.

Local preview without a full `next build`: `npm run build:index` runs the
generator alone and writes to `site/generated/` and `site/public/downloads/`,
so `next dev` can read the same files a production build would produce.

## 5. Generator (`scripts/build-skills-index.mjs`)

### 5.1 Skill index schema

```jsonc
{
  "generatedAt": "2026-09-10T12:00:00Z",
  "skills": [
    {
      "slug": "cl-creation",
      "name": "cl-creation",
      "summary": "Drafts a pull request or CL's title and description from your branch's diff.",
      "description": "<full frontmatter `description` field, verbatim>",
      "body": "<SKILL.md content below the frontmatter, as markdown>",
      "references": [
        { "title": "github-commands.md", "path": "references/github-commands.md" }
      ],
      "hasScripts": false,
      "hasEvals": false,
      "downloadPath": "/downloads/cl-creation.skill",
      "downloadSizeBytes": 15872
    }
  ]
}
```

- `name` and `slug` are both the folder name today (frontmatter `name` and
  the folder name are expected to match; the generator should warn — not
  fail the build — if they diverge, since that's an authoring mistake worth
  surfacing but not worth blocking a deploy over).
- `description` is the raw frontmatter field, kept for the detail page and
  read by Claude for skill routing. It is never shown on the card — see §9.1
  for why.
- **`summary` is a new, required frontmatter field, not a generated one.**
  §9.1 originally proposed deriving it from `description` with a
  first-sentence fallback; that was rejected as a stopgap, not a fix (see
  §9.1 for the reasoning). The actual fix: every `SKILL.md` must carry a
  hand-written `summary:` key in its frontmatter, alongside `name` and
  `description`. The generator reads it directly — no truncation, no
  fallback logic, no derived text. `cl-creation` and `conventional-commits`
  have already been backfilled with one (see §9.1). **The build fails if a
  skill folder's `SKILL.md` is missing `summary`** — same treatment as a
  missing `name` or `description` (§7), not a warning. This is a change to
  the required `SKILL.md` shape for every skill in this repo, present and
  future.
- `references` lists files under `references/`, by relative path, so the
  detail page can link to their raw content (rendered inline or linked out —
  a build-time decision, not a runtime one, since these are static files
  Next.js can read at build time same as `SKILL.md`).
- `hasScripts` / `hasEvals` are booleans only (§3.2 — not rendered as
  content), kept so the UI can show a small "also includes scripts/evals"
  badge on the card or detail page without exposing their contents.

### 5.2 `.skill` packaging

**There is no existing `.skill` format** — `intent.md` names it as a goal,
but no tool in this ecosystem (Claude Code, Cowork, the plugin/skill-creator
tooling) currently reads a file with that extension. This spec defines one
for the purpose of shipping the feature, but treat it as provisional — see
§9.2 for why this needs sign-off before engineering time goes into it.

Definition, as specified here:
- A `.skill` file is a standard zip archive, renamed with a `.skill`
  extension.
- Its contents are the entire skill folder, unmodified: `SKILL.md`,
  `references/`, `scripts/`, `evals/` — whatever exists on disk for that
  skill, with the skill's slug as the archive's single top-level directory
  (e.g. `cl-creation.skill` unzips to a `cl-creation/` folder containing
  `SKILL.md`).
- Built once per skill at build time (§4.2), served as a static file from
  `site/public/downloads/`. No on-demand/serverless zipping — intent.md
  raised this as an option, but for a repo this size (2 skills today, no
  indication of hundreds soon) pre-building is simpler, has no cold-start
  cost, and needs no serverless function or its own error handling.

## 6. Pages

### 6.1 Browse page (`/`)

- Statically generated from `skills-index.json` at build time.
- One card per skill: `name`, `summary` (not the raw `description` — see
  §9.1), a Download button (`<a href={downloadPath} download>`), and a link
  to the detail page.
- Card order: alphabetical by slug for now (stable, no extra field needed).
  Explicitly not addressing search/sort beyond this — out of scope per
  `intent.md`.

### 6.2 Skill detail page (`/skills/[slug]`)

- `generateStaticParams` reads `skills-index.json` and emits one static page
  per skill — no dynamic server route.
- Renders: `name`, full `description`, the `body` markdown (rendered to HTML
  at build time, e.g. via a markdown-to-React pipeline — implementation
  detail, not a design decision this spec needs to pin down), a list of
  `references` (linked), and the same Download button as the card.
- 404s (Next's `notFound()`) for any slug not present in the index — this is
  the natural behavior once routes are statically generated from the index,
  not something that needs separate handling.

## 7. Non-functional requirements

- **No runtime dependencies.** Fully static output (`next build` +
  `next export`-equivalent static generation) — no API routes, no database,
  no environment variables required for the catalog itself to function.
- **Build must fail loudly, not silently, on a malformed `SKILL.md`.** A
  skill folder with a `SKILL.md` missing required frontmatter (`name`,
  `description`, or `summary` — see §9.1) should fail the generator with a
  clear error naming the folder and the missing field, not silently omit the
  skill from the catalog.
- **Zero frontend code changes to add a skill.** Adding a new top-level
  folder with a valid `SKILL.md` and redeploying must be sufficient — this is
  a direct acceptance criterion from `intent.md` and should be covered by a
  smoke test (add a fixture skill folder in CI, assert it appears in the
  generated index).

## 8. Rollout

1. `summary` frontmatter has already been backfilled into `cl-creation` and
   `conventional-commits` (§9.1) — no further authoring work needed before
   engineering starts.
2. Scaffold `site/` (Next.js, TypeScript) with the generator and the two
   pages above, against the two existing skills. §9.1 (summary field) and
   §9.2 (`.skill` format) are both signed off — proceed on the decisions as
   specified, no further approval needed before writing the packaging code.
3. Wire up Vercel: project root `site/`, ignored-build-step rule so unrelated
   skill-content-only commits don't force a rebuild unless desired.
4. Deploy publicly, no auth/access layer — §9.6 confirms this is the
   intended behavior, not a default to reconsider.

## 9. Areas of concern

These are graded by severity. §9.1 and §9.2 are places where `intent.md`'s
plan, taken literally, runs into something that can't be satisfied exactly
as written — they need a decision, not just an implementation.

### 9.1 One `description` field, two audiences — RESOLVED before engineering

`SKILL.md` frontmatter `description` fields in this repo (and across the
wider skills ecosystem) are written **for Claude's skill-routing logic**:
dense, multi-sentence, front-loaded with trigger phrases like "Use this
whenever someone asks to write, draft, or improve a PR/CL title or
description..." That's the right shape for a routing signal. It is the wrong
shape for a card a human scans in half a second.

This was a genuine policy conflict, not a formatting nitpick: the same field
was being asked to serve machine-routing and human-browsing at once, and it
can't optimally serve both. A first draft of this spec proposed papering
over it with a generator-side fallback (first sentence of `description`,
truncation, etc.) — that was rejected as a stopgap: it still ships awkward,
model-oriented phrasing to a human audience, it's fragile (a description
that doesn't front-load its main point produces a bad first sentence), and
it leaves the two fields coupled forever, so every future skill inherits the
same problem by default.

**The real fix, decided before implementation starts:** `summary` becomes a
new, independent, **required** frontmatter field — authored by hand, not
derived from `description` at all.
- `SKILL.md` frontmatter now carries three fields: `name`, `description`
  (for Claude — unchanged, untouched, still the only field Claude's routing
  reads), and `summary` (for humans — one sentence, written for a person
  scanning a card, no "use this whenever..." phrasing).
- This is enforced structurally, not by convention: the generator (§5.1)
  fails the build if `summary` is missing, exactly like a missing `name` or
  `description` (§7). There is no fallback path left to reason about.
- Both skills currently in the repo have already been backfilled:
  - `cl-creation`: "Drafts a pull request or CL's title and description from
    your branch's diff."
  - `conventional-commits`: "Writes a Conventional Commits message and
    commits your staged changes."
- Going forward, writing a skill means writing both a `description` (for
  Claude) and a `summary` (for the catalog) — this is a small addition to
  the authoring workflow, not a burden: one extra line per skill, written
  once, and it's the only way the card content is ever going to read well
  without the generator guessing at authorial intent.
- Because `summary` never touches `description`, this change has zero effect
  on Claude's skill-routing behavior — verified by inspection, since Claude
  only reads the `description` key.

### 9.2 `.skill` is an invented format with no consumer — SIGNED OFF, proceed as specified

Section 5.2 defines a `.skill` format because the feature can't be built
without one, but nothing downloads and *does* anything with a `.skill` file
today — there's no import feature in Claude Code, Cowork, or the plugin
tooling that recognizes this extension. Concretely, the only thing a
recipient of a downloaded `cl-creation.skill` can do with it right now is
rename it to `.zip` and unzip it — which is a legitimate use case only if
"grab a copy of this skill's folder to install elsewhere" is genuinely the
goal, not e.g. "generate a file the plugin/skill installer will recognize."

**Decision:** Joseph has signed off on shipping the `.skill` format exactly
as defined in §5.2 (a zip archive, renamed, containing the unmodified skill
folder) — engineering should proceed on that basis. The underlying fact
doesn't change: nothing today consumes this format automatically, so a
downloaded `.skill` file is, for now, a "rename to `.zip` and unzip"
proposition for whoever receives it. That's an accepted, known trade-off
rather than an open question — if a real `.skill`-aware consumer appears on
the roadmap later with a different expected internal layout, this container
format may need a version bump, but that's a future concern, not a blocker
for this build.

### 9.3 Mixing content and application code in one repo

Until now this repo has been pure content: skill folders Claude reads
directly, gitignored local Claude config, no build step. Adding `site/`
means the repo now has `node_modules`-generating tooling, a build pipeline,
and (implicitly) a reason to add CI. This isn't blocking, but it is a real
shift in what the repo is for, and it introduces coupling risk: a broken
`site/` build (say, a bad dependency bump) could block a PR that only touches
`conventional-commits/SKILL.md`, if CI is set up to gate on the whole repo
rather than per-path. Recommend path-scoped CI (only run the site build/test
job when `site/**` changes) so skill-content PRs never wait on frontend CI.

### 9.4 `.gitignore` needs updating before the first commit

The current `.gitignore` only excludes `.claude`. Before any `site/` code is
committed, it needs entries for `site/node_modules/`, `site/.next/`,
`site/generated/`, and `site/public/downloads/` — otherwise the first
commit risks checking in build output and dependencies, which contradicts
the repo's current lightweight, content-only footprint. This is a two-line
fix, called out here so it isn't missed in the first PR.

### 9.5 Skill/folder-name mismatch isn't validated today

Nothing currently enforces that a `SKILL.md`'s frontmatter `name` matches its
folder name (both skills happen to match today). Since the URL slug is
defined as the folder name (§3.1) while the card can display either, a future
skill with a mismatched `name` would produce a confusing URL/title pairing.
Handled as a build warning, not a blocker, per §5.1 — flagging here so it's a
conscious choice, not an oversight.

### 9.6 Public hosting vs. a solo audience — RESOLVED, not actually a conflict

`intent.md`'s "audience: Joseph, solo, for now, no auth" described who uses
the catalog today, not who's allowed to see it — those turned out to be two
different questions, and only the second one matters for hosting. Confirmed:
this is intended to be a fully public site, consistent with the `skills`
repo itself being public. No auth, no deployment protection, no restricted
access layer — Vercel's default public URL is the correct, deliberate
choice, not a gap to close.

Practical consequence for engineering: since the repo is public, anything in
`references/`, `scripts/`, or `evals/` for any skill — present or future —
is already visible to anyone via the repo itself. The catalog and the
`.skill` downloads don't expose anything the repo doesn't already expose;
they just make it easier to browse and grab. That does mean the "no
sensitive content" assumption isn't the frontend's to enforce — it's a
repo-wide content policy (don't commit anything to a skill folder that
shouldn't be public), not something `site/` needs to guard against. No
build-time redaction or access-gating logic is needed anywhere in this spec.

## 10. Open questions carried forward (not blocking, but unresolved)

- Should reference files render inline on the detail page or link out to the
  raw markdown? (§6.2 leaves this as an implementation detail; either is
  compatible with this spec.)
- Visual design/layout for cards and the detail page — no design pass has
  happened yet; this spec covers structure and data, not visual treatment.
