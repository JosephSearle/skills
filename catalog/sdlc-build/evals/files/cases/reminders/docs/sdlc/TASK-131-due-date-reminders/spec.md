---
status: draft
linked_intent: docs/sdlc/TASK-131-due-date-reminders/intent.md
persona: personal
skills_applied: [security-baseline, compliance-gdpr, ux-personal]
created: 2026-10-19
---

# Spec: Remind me before a task is due

## Requirements
R1. Once a day at 08:00 UTC, every open task whose `dueDate` is the next calendar day triggers one
    reminder to its owner.
R2. Reminders are delivered by email to the user's account address.
R3. Users can opt out of reminders; opted-out users receive none.

## Design approach
A scheduler module started from `src/server.js` runs the daily job, queries
`src/tasks/store.js` for tasks due tomorrow (R1), and sends via a small mailer wrapper (R2). A
`reminders` boolean on the user record controls opt-out (R3).

## Constraints from intent
| Constraint (from intent.md) | How the design meets it |
|---|---|
| No new paid services | Uses the existing SMTP relay (R2) |

## Open questions resolved
- *Email, or something else?* — Resolved: email (R2).
- *Can users opt out?* — Resolved: yes (R3).

## Areas of concern
C1. **compliance-gdpr** — Reminder emails include task titles, which may contain personal data. —
    Owner: Joseph Searle — Status: open
