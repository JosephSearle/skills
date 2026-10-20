---
author: Mei Tanaka
status: draft
linked_issue: TASK-118
created: 2026-10-02
---

# Intent: Export my tasks as a CSV

## Problem
Users who track work in Tasklist have no way to get their tasks out. People who report weekly to a
manager copy titles by hand into a spreadsheet every Friday, which takes 15–20 minutes and drops
due dates.

## Proposed outcome
A signed-in user can download all of their own tasks as a CSV file that opens cleanly in Excel or
Google Sheets, with title, status, due date, and created date.

## Affected users and systems
All Tasklist users. Touches the tasks API (`src/tasks/`) and the request routing in
`src/server.js`. No other systems.

## Constraints
- No new npm dependencies.
- Must use existing session auth — no API keys or share links.
- A user must never be able to export someone else's tasks.

## Open questions
- Should done tasks be included, or only open ones?
