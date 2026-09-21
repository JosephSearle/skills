# Vercel Rollback — Cheat Sheet (print/pin this)

Full reasoning: [vercel-rollback-playbook.md](vercel-rollback-playbook.md)

## Does this apply?

**Yes** — production (not preview) deploy causing:
- SEV-1: down/unusable for all customers, or
- SEV-2: broken/degraded for a meaningful subset

**No** — preview URL broken · Vercel platform-wide outage (check
[vercel-status.com](https://www.vercel-status.com) first) · a known bad-deploy pattern with an
existing scripted fix (that's a runbook) · SEV-3 or lower (cosmetic/minor).

## Roles

| Role | Owns |
|---|---|
| Incident Commander (IC) | Decision to roll back, when, and declares resolution |
| Comms lead | Status page, internal updates, customer messaging — never doubles as IC above SEV-2 |
| Technical responder | Runs the rollback, verifies recovery |

## Checklist

- [ ] **Detect** — confirm it's prod, gauge blast radius (all vs. subset → SEV-1 vs SEV-2)
- [ ] **Open incident channel, name an IC**
- [ ] **Post initial internal update** (no ETA needed yet)
- [ ] **Assess**:
  - [ ] Vercel platform incident? → check vercel-status.com
  - [ ] What changed vs. last known-good deploy? (commit, build, env vars, flags)
  - [ ] Is the last known-good deployment still retained (not pruned)?
  - [ ] Did this deploy ship a DB migration? (rollback alone may not fix it)
- [ ] **Send first customer-facing update** if impact confirmed: what's affected + being worked
      on + when next update comes. No root-cause guesses.
- [ ] **Escalate** if missing Vercel permissions, or backend/DB owner needed for a migration
- [ ] **Roll back**:
  - [ ] Promote/alias last known-good deployment to production (dashboard "Promote to
        Production", `vercel rollback [url]`, or promote/alias API) — don't wait on a fresh build
  - [ ] If migration involved: confirm compatibility with backend owner before/instead of rollback
  - [ ] If env vars changed since: confirm old deployment still works against current env
  - [ ] **Verify**: health checks, key flows, error rate/latency back to baseline, correct
        deployment aliased to prod domain
- [ ] **Follow-up updates** on the cadence promised until resolved
- [ ] **If not fixed** — back to Assess, don't repeat the same rollback blindly
- [ ] **Resolve** — IC confirms impact gone and stable, comms lead sends final update
- [ ] **Postmortem** — required for any SEV-1/SEV-2, owned by IC/primary responder, drafted within
      a few days

## Escalation / contacts

_Fill in for your org: on-call rotation, Vercel project admins, backend/DB on-call, status page
tool, incident channel naming convention._
