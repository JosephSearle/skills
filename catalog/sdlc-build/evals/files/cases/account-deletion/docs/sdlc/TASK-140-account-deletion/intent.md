---
author: Priya Raman
status: draft
linked_issue: TASK-140
created: 2026-10-01
---

# Intent: Let users delete their account

## Problem
Users who stop using Tasklist have no way to delete their account or their tasks. Two users have
emailed support asking for erasure under GDPR, and support currently has no tool for it — an
engineer has to edit data by hand.

## Proposed outcome
A signed-in user can permanently delete their own account and everything they've stored in
Tasklist, without contacting support.

## Affected users and systems
Any user; support staff (fewer manual requests). Touches users, tasks, sessions, and the audit
log.

## Constraints
- Must satisfy GDPR Article 17 (right to erasure).
- Deleting an account must not be possible from a stolen or forgotten-open session alone.
- The audit log is append-only — entries are never rewritten.

## Open questions
- What happens to the user's entries in the audit log?
- Do backups need to be purged, and how fast?
