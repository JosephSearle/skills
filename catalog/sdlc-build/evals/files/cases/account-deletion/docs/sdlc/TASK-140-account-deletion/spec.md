---
status: draft
linked_intent: docs/sdlc/TASK-140-account-deletion/intent.md
persona: personal
skills_applied: [security-baseline, compliance-gdpr, ux-personal]
created: 2026-10-09
---

# Spec: Let users delete their account

## Requirements
R1. `DELETE /account` permanently deletes the signed-in user's user record and all of their tasks.
R2. The request must include the user's current password in the JSON body
    (`{"password": "..."}`); a missing or wrong password returns 403 and deletes nothing.
R3. After a successful deletion, every session belonging to that user is invalidated, not just
    the one that made the request.
R4. The deletion is recorded in the audit log as an `account.delete` event.
R5. The response is `200 {"deleted": true}`; the operation is not reversible and there is no
    soft-delete or grace period.

## Design approach
Add a `DELETE /account` route in `src/server.js` behind `requireUser`, handled by a new
`src/users/routes.js` (R1, R5). The handler re-checks the password with
`users.checkPassword` before doing anything (R2), deletes the user's tasks then the user record
via new `deleteByUser`/`delete` store functions (R1), invalidates all of that user's sessions with
a new `destroyAllSessionsFor(userId)` in `src/auth/session.js` (R3), and writes an audit entry
(R4) — whose content depends on C2.

## Constraints from intent
| Constraint (from intent.md) | How the design meets it |
|---|---|
| GDPR Article 17 (right to erasure) | User record and tasks hard-deleted (R1, R5); audit log and backups — Not met yet: see C2 and the carried-forward question |
| Not possible from a stolen session alone | Password re-confirmation (R2) and all sessions invalidated (R3) |
| Audit log is append-only | No existing entries are rewritten; see C2 for what the new entry may contain |

## Open questions resolved
- *What happens to the user's entries in the audit log?* — Not resolved here; raised as C2, which
  is with the DPO.
- *Do backups need to be purged, and how fast?* — Carried forward: unresolved. Owner: infra
  (Tom Becker). Backups are outside this codebase; nothing in this change can depend on the answer
  until infra decides.

## Areas of concern
C1. **security-baseline** — Account deletion is destructive and irreversible; a hijacked session
    could erase a victim's data. — Owner: Joseph Searle — Status: resolved: password
    re-confirmation (R2) and invalidation of all sessions (R3).
C2. **compliance-gdpr** — Existing audit-log entries store the user's email address and the
    log is append-only, which conflicts with erasure; the new `account.delete` entry (R4) would
    also need *some* identifier. Options include pseudonymizing (hashed user id, no email) or
    rewriting the log. — Owner: Dana Okafor (DPO) — Status: open
