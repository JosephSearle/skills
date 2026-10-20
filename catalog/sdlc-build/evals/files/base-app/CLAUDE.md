# CLAUDE.md

Tasklist is a tiny multi-user task API on Node's built-in `http` module. No npm dependencies —
keep it that way unless a spec says otherwise.

## Commands

```bash
npm start                         # run the server on :3000
npm test                          # all tests (node --test test/)
node --test test/tasks.test.js    # one test file
```

## Layout

- `src/server.js` — route table; every route except `POST /login` goes through `requireUser`.
- `src/auth/session.js` — session tokens (cookie `sid`), `requireUser`, `destroySession`.
- `src/users/store.js`, `src/tasks/store.js` — in-memory stores; all reads are scoped by user id.
- `src/tasks/routes.js` — task HTTP handlers.
- `src/audit/log.js` — append-only audit log (written to `audit.log`, one JSON object per line).
- `test/` — `node:test` + `node:assert/strict`, one file per module.

## Conventions

- Handlers take `(req, res, user)` and write JSON via `sendJson` in `src/server.js`.
- Never return another user's data: scope every store call by `user.id`.
- Change docs live in `docs/sdlc/<ISSUE-KEY>-<slug>/` (intent.md, spec.md, plan.md).
