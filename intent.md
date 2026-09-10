# Intent: Skills Catalog Frontend

## Problem

The `skills` repo holds a growing set of Claude skills (currently `cl-creation` and
`conventional-commits`), each defined by a `SKILL.md` with YAML frontmatter
(`name`, `description`) plus supporting `references/`, `scripts/`, and `evals/`
files. Right now the only way to see what a skill does is to open its `SKILL.md`
directly in the repo, and there's no way to grab a skill as a standalone file to
use elsewhere. There's no browsable view of "what skills exist and what do they
do," which will get harder to keep track of as more skills are added.

## Goal

A read-only web catalog, hosted on Vercel, that lets Joseph browse the skills in
this repo as cards, open an individual skill to read its full content, and
download any skill as a `.skill` file to use outside the repo.

## Audience

Joseph, solo, for now. No auth, no multi-user features. Not ruling out sharing
the URL with teammates later, but that's not a driver of any decision here.

## Scope

**In scope**
- A browse page listing every skill in the repo as a card: name, description
  (likely truncated/summarized), and a **Download** button — minimal but enough
  to identify the skill at a glance.
- A per-skill page that renders the skill's `SKILL.md` (frontmatter + body) and
  surfaces its supporting files (e.g. `references/*.md`) as linked/readable
  content.
- Download-as-`.skill` capability: since packaging a skill folder into a
  distributable `.skill` file doesn't exist yet, this is new work, not just
  wiring up an existing artifact. Two options to weigh at design time:
  (a) pre-build every skill's `.skill` file as a build step, served as a static
  download, or (b) generate the `.skill` file on-demand (e.g. a serverless
  function that zips the skill folder on request). Either way the browse-page
  card and the skill page both need a working download action.
- A build-time step that walks the repo, extracts skill metadata into a
  generated JSON index, and the frontend reads from that index rather than
  parsing the filesystem at runtime.
- URL slug = skill folder name (e.g. `cl-creation` → `/skills/cl-creation`).
- Designed to scale as more skills are added to this repo over time — adding a
  new skill folder should require no frontend code changes, only a rebuild.

**Out of scope (for this iteration)**
- Any editing/authoring of skills through the UI (create/update/delete) — this
  is read-only.
- Search, filtering, or tagging — deferred until the skill count makes it
  necessary.
- Surfacing eval results, scripts, or usage stats as content — deferred; only
  the documentation content (and the download) is shown.
- Pulling in skills from other repos/sources (e.g. agentcraft, milvus-*) —
  this catalog is scoped to this one repo only.
- `.claude/skills` — this is Joseph's local Claude project configuration for
  working in this repo, not a skills source. It's excluded entirely: not
  scanned, not indexed, not part of any future plan for this catalog.
- Auth / access control.

## Data source

- Skill metadata (name, description, and pointers to body + reference files)
  is extracted from each top-level skill folder's `SKILL.md` frontmatter and
  content by a build-time script, producing a generated JSON index committed
  to the repo or produced fresh on each Vercel build.
- The frontend consumes only that generated index — it does not parse
  `SKILL.md` files at runtime. This decouples the UI from the exact on-disk
  skill folder structure and gives a stable contract to build the frontend
  against.
- Open question to resolve in design: does the generator run only at Vercel
  build time, or also as a local script Joseph can run to preview changes
  before pushing?

## Stack

- Next.js, deployed on Vercel. Static generation from the build-time JSON
  index; file-based routing per skill (e.g. `/skills/[slug]`).

## Success criteria

- Joseph can open the deployed URL and see every skill currently in the repo
  as a card, with name and description visible without a click.
- Clicking a card's Download button (or the equivalent on the skill's own
  page) downloads a working `.skill` file for that skill.
- Clicking into a skill shows its full `SKILL.md` content, readably formatted
  (not a raw markdown/frontmatter dump).
- Adding a new skill folder to the repo and redeploying makes it appear in the
  catalog — as a card and a download — with no frontend code changes required.

## Open questions for design stage

- Exact shape of the generated JSON index (per-skill fields beyond
  name/description — e.g. do reference files get inlined or linked?).
- Exact spec of the `.skill` file format: what's included (SKILL.md +
  references + scripts + evals, or a subset?), how it's named, and whether
  it's pre-built at compile time or generated on-demand.
- Where the index-generation (and `.skill`-packaging) script lives and how
  it's wired into the Vercel build (`next build` prebuild step vs. separate
  script vs. serverless function).
- What "minimal but important" means for the card — confirm the exact field
  set (name, one-line description, anything else?) before building.
- Visual design / layout conventions for the cards and the skill detail page
  — not decided yet, deferred to design stage.
