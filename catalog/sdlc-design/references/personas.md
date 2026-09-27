# Policy Personas

A persona is a named grouping of policy skills — not a skill itself, just
a lookup. Add or remove a policy skill from a persona's list without
touching any other persona's row or the skill itself. Skills come from
any policy domain (security, brand, compliance, UX) — this table doesn't
distinguish domain in its structure, only in each skill's own name.

| Persona    | Policy skills                                                                          |
|------------|------------------------------------------------------------------------------------------|
| personal   | security-baseline, brand-personal, ux-personal, compliance-gdpr, compliance-eu-ai-act    |
| newrocket  | security-baseline, security-api, security-llm, security-mcp, security-agent              |

`newrocket`'s row only covers the security family so far — compliance
and brand/UX policy skills for that persona haven't been scoped yet.
Don't add anything to that row without the user explicitly asking for it.

## How sdlc-design uses this

1. Ask which persona applies (or infer from repo/org context if already
   established for this session) — don't guess silently when it's
   ambiguous.
2. Look up that persona's row — load every skill listed, regardless of
   which policy domain it belongs to.
3. If the project's actual scope suggests a skill beyond the persona's
   defaults (e.g. a `personal` project that suddenly touches an MCP
   server, which the `personal` row doesn't cover), ask before silently
   adding or omitting it.
4. Unknown/new persona: fall back to asking per-skill, then optionally
   offer to save the answer as a new persona row for next time.
5. If a skill named in the resolved row isn't actually loaded/available
   in this session, say so explicitly as a limitation on the spec rather
   than silently proceeding as if that policy doesn't apply.

## Adding a new policy skill later

Write the skill (its own SKILL.md, wherever it lives), then add its name
to whichever personas' rows should include it. No other persona's row,
and no other skill's own content, needs to change.
