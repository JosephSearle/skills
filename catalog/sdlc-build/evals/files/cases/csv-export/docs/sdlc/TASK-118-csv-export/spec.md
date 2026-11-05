---
status: draft
linked_intent: docs/sdlc/TASK-118-csv-export/intent.md
persona: personal
skills_applied: [security-baseline, compliance-gdpr, ux-personal]
created: 2026-10-06
---

# Spec: Export my tasks as a CSV

## Requirements
R1. `GET /tasks/export.csv` returns the signed-in user's tasks as CSV with a header row and the
    columns `id,title,status,due_date,created_at`, all tasks (open and done), ordered by
    `created_at` ascending.
R2. The endpoint requires an authenticated session; unauthenticated requests get 401, and the
    export only ever contains tasks whose `userId` is the requester's.
R3. Any cell value beginning with `=`, `+`, `-`, or `@` is prefixed with a single quote, and every
    field is quoted and escaped per RFC 4180 (embedded quotes doubled, commas and newlines kept
    inside quotes).
R4. The response sets `Content-Type: text/csv; charset=utf-8` and
    `Content-Disposition: attachment; filename="tasks-YYYY-MM-DD.csv"` using the server's current
    UTC date.

## Design approach
Add an `exportCsv` handler to `src/tasks/routes.js` and a pure `toCsv(tasks)` serializer in a new
`src/tasks/csv.js` (R1, R3), so formatting can be unit-tested without HTTP. Register
`GET /tasks/export.csv` in the route table in `src/server.js` behind `requireUser` (R2). The
handler reads via `store.listByUser(user.id)` — the same scoping every other task read uses (R2).
Headers are set directly on the response rather than through `sendJson`, which is JSON-only (R4).

## Constraints from intent
| Constraint (from intent.md) | How the design meets it |
|---|---|
| No new npm dependencies | Serializer is hand-written in `src/tasks/csv.js` (R3) |
| Existing session auth only | Route registered behind `requireUser` (R2) |
| Never export someone else's tasks | Reads only via `store.listByUser(user.id)` (R2) |

## Open questions resolved
- *Should done tasks be included?* — Resolved: yes, all tasks are included with their `status`
  column so users can filter in their spreadsheet (R1). Confirmed with Mei Tanaka on 2026-10-05.

## Areas of concern
C1. **security-baseline** — CSV/formula injection: task titles are user-controlled and are opened
    in spreadsheet software. — Owner: Joseph Searle — Status: resolved: neutralize leading
    `= + - @` and quote all fields (R3).
C2. **compliance-gdpr** — The export contains personal data (task titles can contain names). —
    Owner: Joseph Searle — Status: resolved: export only to the authenticated owner (R2); no
    server-side copy of the file is written or logged.
