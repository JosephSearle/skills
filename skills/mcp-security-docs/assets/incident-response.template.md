# Incident Response Plan — <PLACEHOLDER: Project Name>

<!-- USAGE: This plan follows CIS Control 17 (Incident Response Management) and the Kubernetes
     blameless retrospective model. Replace all <PLACEHOLDER: ...> markers.
     This is an L3 document — required for large-user-base or foundation-affiliated projects.
     Activate this plan when a security incident is confirmed (a vulnerability is being actively
     exploited, or a breach of data/credentials has occurred). For vulnerability reports that
     have NOT been exploited, use docs/security/vulnerability-disclosure.md instead. -->

**Version:** 1.0
**Last reviewed:** <PLACEHOLDER: YYYY-MM-DD>
**Plan owner:** <PLACEHOLDER: name / team>
**Escalation contact:** <PLACEHOLDER: name, role, email/phone>

---

## Scope

This plan applies to confirmed or suspected security incidents affecting:
- The <PLACEHOLDER: project name> MCP server
- Data processed or stored by the server
- Infrastructure hosting the server
- Credentials or secrets used by the server

---

## Phase 1 — Detection and Initial Assessment

**Sources that may trigger this plan:**
- SIEM alert from audit log anomaly (unusual tool call volume, failed auth spike)
- External vulnerability report via SECURITY.md reporting channel
- Automated dependency scan (Dependabot, npm audit) finding active exploitation
- User or operator report of unexpected behaviour
- Third-party threat intelligence notification

**Initial assessment (within 1 hour of detection):**

1. Assign an **Incident Commander** (IC) — typically the Security Champion or senior maintainer
2. Open a private communication channel for the response team (dedicated Slack channel / private GitHub issue)
3. Document the initial timeline:
   ```
   <YYYY-MM-DD HH:MM UTC>  Incident detected via <source>
   <YYYY-MM-DD HH:MM UTC>  IC <name> assigned
   <YYYY-MM-DD HH:MM UTC>  Initial severity assessment: <Critical / High / Medium>
   ```
4. Assign initial severity:

   | Criterion | Severity |
   |-----------|----------|
   | Active data exfiltration confirmed | Critical |
   | Credentials/secrets compromised | Critical |
   | Active exploitation of known CVE | High |
   | Unexplained privilege escalation | High |
   | Suspected (unconfirmed) breach | Medium |
   | Anomalous behaviour, no confirmed exploit | Low |

---

## Phase 2 — Triage

**Timeline:** Complete within 2 hours of detection for Critical/High; 24 hours for Medium/Low.

**Actions:**

1. **Preserve evidence** before any containment action:
   - Export and archive affected audit logs (tool call logs, auth logs, infrastructure logs)
   - Take a snapshot of affected infrastructure if cloud-hosted
   - Do not modify or delete anything until evidence is captured

2. **Identify the attack vector:**
   - Which tool(s) or endpoint(s) were involved?
   - Which OAuth client / token `sub` claim was used?
   - Was the vector tool poisoning, prompt injection, token theft, or something else?

3. **Determine blast radius:**
   - What data was accessible? What was likely exfiltrated?
   - Are downstream services or databases affected?
   - Are other MCP clients or users affected?

4. **Notify stakeholders** (see Communication Plan below)

---

## Phase 3 — Containment

**Immediate containment options (apply in order of least disruption):**

```
Is the attack ongoing?
  └─ YES → Can you revoke the specific OAuth token/client?
       └─ YES → Revoke immediately; continue monitoring
       └─ NO  → Disable the affected tool(s) via feature flag or deployment config
                If insufficient → take MCP server offline; notify users
  └─ NO  → Proceed to Phase 4 (Eradication)
```

**Containment actions checklist:**
- [ ] Revoke compromised OAuth tokens via the authorization server
- [ ] Rotate compromised service-account credentials and secrets
- [ ] Block the source IP(s) at the load balancer or WAF (if applicable)
- [ ] Disable affected tool(s) in the MCP server configuration
- [ ] Notify the authorization server / identity provider of the incident
- [ ] If credentials were leaked: rotate all secrets (database passwords, API keys, service account keys)

---

## Phase 4 — Eradication

**Actions:**

1. Identify and remove the root cause:
   - Patch the vulnerability (follow docs/security/vulnerability-disclosure.md for coordinated fix development)
   - Remove injected backdoors or malicious code if a supply-chain compromise occurred
   - Revoke and regenerate all potentially-compromised credentials

2. Verify the root cause is fully addressed in a staging environment before production deployment

3. Update threat model to reflect the new attack class

---

## Phase 5 — Recovery

**Actions:**

1. Restore service in a controlled manner:
   - Deploy the patched version with all rotated credentials
   - Monitor closely for 24 hours post-restoration (heightened SIEM alerting threshold)
   - Verify normal tool call patterns resume

2. Confirm affected users/operators have been notified (see Communication Plan)

3. Publish a security advisory if the incident involved a CVE or public exploitability:
   - Follow docs/security/vulnerability-disclosure.md Phase 4 (Coordinated Disclosure)

---

## Phase 6 — Blameless Retrospective

**Schedule within 14 days of incident resolution.**

The retrospective process MUST be blameless — the goal is process improvement, not assigning blame. (Kubernetes model: "The retrospective process should be blameless and focus on the systems and processes, not individuals.")

**Retrospective report structure:**

```markdown
# Security Incident Retrospective — <incident ID>

**Date of incident:** YYYY-MM-DD
**Date of retrospective:** YYYY-MM-DD
**Facilitator:** <name>
**Attendees:** <names>

## Timeline
<Chronological list of events from detection to resolution>

## What Happened
<1-2 paragraph narrative of the incident>

## What Went Well
- <item>

## What Could Be Improved
- <item>

## Root Cause Analysis
<The 5-Why analysis or equivalent>

## Action Items
| Action | Owner | Due date |
|--------|-------|----------|
| <item> | <name> | YYYY-MM-DD |

## Contributing Factors
<System/process factors; no individual blame>
```

**Distribute to:** <PLACEHOLDER: security team, maintainers, relevant stakeholders>
**Archived at:** `docs/security/retrospectives/<YYYY-MM-DD>-<incident-id>.md`

---

## Communication Plan

### Internal Notifications

| Severity | Notify | Within |
|----------|--------|--------|
| Critical | All maintainers + <PLACEHOLDER: org security team> | 1 hour |
| High | Incident Commander + Security Champion | 4 hours |
| Medium | Security Champion | 24 hours |
| Low | Security Champion | 48 hours |

### External Notifications

| Recipient | When | Via |
|-----------|------|-----|
| Affected users / operators | Before or with public advisory | GitHub Security Advisory + release notes |
| Downstream distributors | ≥7 days before public disclosure (Critical/High) | Private email |
| Original vulnerability reporter | Throughout the process | GitHub Advisory thread |
| CVE authority (GitHub CNA) | When fix is ready; CVSS ≥4.0 | GitHub Advisory request |

### Communication Template (user notification):

```
Subject: Security Notice — <Project Name> <version> — Please Upgrade

We are writing to inform you of a security vulnerability in <project name> that was reported
and resolved on <date>.

Affected versions: <X.Y.Z and earlier>
Fixed version: <X.Y.Z+1>
Severity: <Critical/High/Medium>

<One paragraph describing what was vulnerable and what an attacker could do.>

We recommend upgrading immediately:
  npm install <package>@<X.Y.Z+1>

Full details: <GitHub GHSA URL>

We thank <reporter or "the anonymous reporter"> for responsibly disclosing this issue.
```

---

## Tools and Resources

| Tool | Purpose |
|------|---------|
| GitHub Security Advisories | Private advisory drafting and CVE requests |
| <PLACEHOLDER: SIEM tool> | Audit log analysis and alerting |
| <PLACEHOLDER: secrets manager> | Credential rotation |
| <PLACEHOLDER: communication channel> | Incident communication |

---

*Next review of this plan: <PLACEHOLDER: YYYY-MM-DD> or after any significant infrastructure change.*
