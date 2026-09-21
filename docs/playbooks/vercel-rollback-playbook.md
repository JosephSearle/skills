# Vercel Production Rollback Playbook

**Lineage:** General operational/availability (no adversary implied) — follows the
detect → communicate → assess → escalate → resolve → postmortem arc, not the security-incident
PICERL lifecycle. If at any point evidence emerges that the bad production state was caused by
unauthorized access, a compromised deploy credential, or injected malicious code (not just a bad
build or bad config), stop and escalate to a security-incident response process instead — this
document assumes an ordinary bad deploy, not a compromise.

**Cheat sheet:** [vercel-rollback-cheat-sheet.md](vercel-rollback-cheat-sheet.md) — print/pin this
during a live incident. This document is the reasoning behind it, read in advance.

## When this playbook applies

**In scope** — a production deployment on Vercel (the live domain, not a preview URL) is causing
customer-facing impact of SEV-1 or SEV-2 severity:

- **SEV-1**: the production site/app is down or unusable for all customers following a recent
  deploy (5xx storm, build succeeded but runtime crashes, broken auth, checkout/critical-path
  failure).
- **SEV-2**: production is broken or badly degraded for a meaningful subset of customers or
  traffic (one region, one route, one browser/device class, a feature flag rollout gone wrong).
- The proposed or already-attempted fix is "get back to the last known-good state," not a
  targeted code fix — i.e., rollback is genuinely on the table as the fastest path to recovery.

**Out of scope** — handle these elsewhere, not with this playbook:

- A **preview deployment** is broken. Previews aren't customer-facing; there's no incident.
- Production is degraded but the cause is **not the app's own deploy** — an upstream API outage,
  DNS/registrar issue, or a Vercel platform-wide incident with no working rollback target. Rolling
  back your own deployment won't fix a Vercel-side outage; check
  [vercel-status.com](https://www.vercel-status.com) early (Phase 2 below) to rule this out.
- A **known, previously-seen bad-deploy pattern with a scripted fix** already exists (e.g. "the
  build always needs `VERCEL_FORCE_NO_BUILD_CACHE=1` after touching X config") — that's a runbook,
  not a playbook; use the sibling runbook skill/doc instead of improvising through this one.
- Cosmetic issues, minor bugs, or anything that doesn't block core product use (SEV-3 or lower
  per the severity scale below) — route through normal bug triage, not an incident process.

## Severity scale

This repo has no pre-existing incident severity scale, so this playbook adopts PagerDuty's open
SEV-1–SEV-5 taxonomy as the default, with the major-incident line at SEV-1/SEV-2 (consistent with
Atlassian's convention):

| Severity | Meaning | Triggers this playbook? |
|---|---|---|
| SEV-1 | Critical — production down/unusable for all customers, public notification + exec involvement | Yes |
| SEV-2 | Critical — down/broken for many customers or a major subset | Yes |
| SEV-3 | Stability or minor issue needing immediate service-owner attention | No — runbook/normal triage |
| SEV-4 | Minor, doesn't block product use | No |
| SEV-5 | Cosmetic | No |

If the org later adopts its own severity scale, replace this table and re-anchor the invocation
boundary above to it.

## Roles

Keep these separated even if the responding team is small — the moment one person is both
deciding what to do and typing the customer update, one of those jobs gets rushed.

- **Incident Commander (IC)** — owns the decision of whether to roll back, when, and declares
  resolution. Does not personally run the rollback unless they're also the only technical
  responder available.
- **Communications lead** — owns the status page, the internal incident channel updates, and any
  customer-facing messaging. Never the same person as the IC on anything above SEV-2.
- **Technical responder(s)** — inspects the deployment, runs the rollback (via Vercel dashboard,
  `vercel rollback`, or the `request_promote`/deployment-alias tooling), and verifies recovery.

## Phase 1 — Detect

Triggered by an alert (error-rate spike, uptime check failure, failed health check), a customer
report, or a developer noticing immediately after their own deploy. Whoever detects it:

- Confirms this is production (the aliased/primary domain), not a preview URL.
- Gets a rough sense of blast radius (all traffic vs. a route/region/segment) — this is what
  distinguishes SEV-1 from SEV-2 and decides whether this playbook applies at all.
- Opens the incident: names an IC, opens a dedicated channel (don't triage in a general channel).

## Phase 2 — Open comms & assess

**Open comms first, assess in parallel** — don't wait for a full diagnosis before telling people
something's being looked at.

- Communications lead posts an initial internal note: what's suspected, who's on it, no ETA yet.
- Technical responder(s) check, in rough order of speed-to-signal:
  1. Is this a Vercel platform incident, not us? Check [vercel-status.com](https://www.vercel-status.com).
  2. What changed? Compare the current production deployment against the last known-good one —
     git commit, build logs, environment variable diffs, and whether a feature flag flipped
     without a code deploy (a flag flip needs a flag revert, not a Vercel rollback).
  3. Is there a Vercel deployment in the project's history that was last known-good and is still
     retained (Vercel prunes old deployments over time — confirm the target still exists before
     committing to rollback as the plan)?
  4. Is the failure isolated to the deploy itself, or does it point to a dependency (database
     migration that ran as part of this deploy and can't be trivially rolled back with the code)?
     A rollback that reverts code but leaves an incompatible schema behind can make things worse —
     check whether this deploy shipped a migration before promising rollback alone will fix it.
- Based on this, the IC decides: roll back now, roll back after a specific check, or fix forward
  instead (e.g. if the bad state was caused by an external dependency and the previous deployment
  would fail identically).

## Phase 3 — Initial customer-facing update

If customer-facing impact is confirmed (SEV-1, or SEV-2 with visible impact), the communications
lead sends the first external update. Minimum bar: what's affected, that it's being actively
worked on, and when the next update will come. Do not guess at root cause publicly — "we're
investigating a deployment issue affecting [X]" is enough; "we accidentally broke Y because of Z"
is not, especially before it's confirmed.

## Phase 4 — Escalate & delegate

- If the on-call responder doesn't have Vercel project access or deploy permissions, this is
  where that gets escalated — don't let permissions block the fix once the decision is made.
- If the root cause turns out to involve a paired backend/database change, the DB or backend
  on-call gets pulled in now, not after the rollback is attempted and found insufficient.
- The IC decides whether this needs exec visibility (typically automatic at SEV-1).

## Phase 5 — Execute rollback (technical responder)

This is deliberately guidance, not a rigid numbered sequence — the exact mechanism depends on
what Phase 2 found:

- **Straightforward case (bad code deploy, no migration involved):** promote/alias the last
  known-good deployment to production — via the Vercel dashboard's "Promote to Production" on the
  target deployment, `vercel rollback [deployment-url]`, or the `request_promote`/alias-assignment
  API — rather than pushing a revert commit and waiting on a fresh build. The point of rollback is
  speed: reuse an already-built, already-verified deployment instead of building a new one.
- **Migration involved:** decide with the backend owner whether the migration is backward
  compatible with the old code. If not, rolling back the app alone will not resolve the incident —
  the migration itself needs a compensating rollback, or the fix-forward path is faster than
  untangling both.
- **Environment variable or config drift:** if the last known-good deployment relied on env vars
  that have since changed (rotated secrets, removed config), confirm those still match before
  promoting it — an old deployment promoted against new/missing env vars can fail differently
  than either the old or new state.
- **Verify recovery**, don't just trust the promote succeeded: hit the health check / key user
  flows, watch error rate and latency return to baseline, confirm the right deployment is aliased
  to the production domain.

## Phase 6 — Follow-up comms

Communications lead sends updates on the cadence set at Phase 3 (don't let "next update" pass
silently) until resolution, then a resolution notice once the IC confirms recovery is verified
and stable — not just improved.

## Phase 7 — Review / iterate

If the first rollback attempt didn't fully resolve things, loop back to Phase 2's assessment
rather than repeating the same rollback — re-check blast radius, re-check whether a migration or
external dependency was missed the first time.

## Phase 8 — Resolve

IC declares resolution once impact is confirmed gone and stable (not just "looks better"), and
the communications lead sends the final customer-facing update if one went out earlier.

## Postmortem handoff

Any SEV-1 or SEV-2 triggers a blameless postmortem. The IC owns assigning a postmortem writer
(usually the IC themselves or the primary technical responder) and it should be drafted within a
few business days of resolution, while details are fresh. At minimum, the postmortem should
capture: what let the bad deploy reach production undetected (was there a CI gate that should
have caught this, e.g. the `e2e`/`build-index` checks this repo already runs on `main`?), whether
the rollback path itself worked cleanly or hit friction (missing permissions, pruned deployment,
migration incompatibility), and one or two concrete follow-ups — not just "be more careful."

This repo doesn't yet have a standing postmortem template/location; if this playbook gets used for
a real incident, that's a good trigger to set one up (e.g. `docs/postmortems/`) rather than losing
the writeup to a chat thread.
