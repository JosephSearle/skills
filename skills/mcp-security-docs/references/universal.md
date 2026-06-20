# Universal Security Documentation Reference

## OSPS Baseline v2026.02.19 — Documentation Controls

The OpenSSF OSPS Baseline is the primary checklist backbone. It is tiered (L1/L2/L3), MUST-only, and cross-mapped to NIST SSDF, EU CRA, and OWASP OpenCRE. Implement it in order — L1 is the floor for every project.

### Maturity Levels

- **L1** — Any project, any size, any team
- **L2** — ≥2 maintainers with a consistent user base
- **L3** — Large consistent user base or foundation membership (CNCF, etc.)

### Documentation (DO) Family

| Control | Level | Requirement |
|---------|-------|-------------|
| DO-02.01 | L1 | A guide for reporting defects and vulnerabilities must exist (at minimum: a contact method and what information to include) |
| DO-06.01 | L2 | The project must describe its dependency management policy (which dependencies, how updates are handled) |
| DO-07.01 | L2 | Build-from-source instructions must exist |
| DO-03.01 | L3 | Release integrity verification instructions must exist |
| DO-04.01 | L3 | Support scope and duration must be documented |
| DO-05.01 | L3 | Security-update EOL statement must exist |

### Vulnerability Management (VM) Family

| Control | Level | Requirement |
|---------|-------|-------------|
| VM-02.01 | L1 | Security contacts must be published (SECURITY.md or equivalent) |
| VM-01.01 | L2 | CVD policy must include an explicit response timeframe (in days) |
| VM-03.01 | L2 | A private vulnerability reporting channel must exist |
| VM-04.01 | L2 | Disclosed vulnerabilities must be publicly documented |
| VM-04.02 | L3 | VEX documents for non-exploitable dependency findings |
| VM-05.01 | L3 | SCA remediation policy: critical/high CVEs must be fixed or risk-accepted within a documented timeframe |
| VM-06.01 | L3 | SAST findings must be remediated or risk-accepted per a documented policy |

### Security Assessment (SA) Family

| Control | Level | Requirement |
|---------|-------|-------------|
| SA-01.01 | L2 | Design documentation must exist |
| SA-02.01 | L2 | External interface descriptions must exist |
| SA-03.01 | L2 | A security assessment must be documented (self-assessment is sufficient) |
| SA-03.02 | L3 | Threat modeling and attack surface analysis must exist |

---

## OpenSSF Scorecard — Documentation-Relevant Checks

Scorecard runs weekly against the 1 million most-critical open source projects (by direct dependencies). It produces 0–10 scores per check. These checks directly affect documentation:

| Check | What it looks for | Target |
|-------|------------------|--------|
| **Security-Policy** | `SECURITY.md` present in root, `docs/`, or `.github/`; quality heuristics (reporting channel, SLA, scope) | 10/10 |
| **CII-Best-Practices** | OpenSSF Best Practices badge (passing/silver/gold) | Passing badge minimum |
| **Vulnerabilities** | Unfixed CVEs via OSV database | 0 unfixed critical/high |
| **Maintained** | Recent commit activity | Active |

Run Scorecard locally:
```bash
docker run -e GITHUB_AUTH_TOKEN=<token> gcr.io/openssf/scorecard:stable --repo=<github-url>
```

Or view results at: `https://scorecard.dev/viewer/?uri=github.com/<org>/<repo>`

---

## GitHub Security Tooling Integration

### Private Vulnerability Reporting (PVR)

Adds a "Report a vulnerability" button to the repo's Security tab. Researchers submit reports privately; maintainers collaborate in a temporary private fork before disclosure. Enables:

- `github.com/<org>/<repo>/security/advisories/new` — the submission URL to put in SECURITY.md
- Temporary private fork for coordinated fix development
- CVSS v3.1 and v4.0 scoring
- CWE tagging
- GitHub CNA CVE assignment (typically within ~72 hours of request)

**Enable:** Settings → Security → Private vulnerability reporting → Enable

### Repository Security Advisories

- GHSA IDs: `GHSA-xxxx-xxxx-xxxx` format
- Published in OSV format; powers Dependabot and code scanning
- CVSS scoring (v3.1 and v4.0)
- Credits field for researchers
- Link in SECURITY.md to the advisories page: `github.com/<org>/<repo>/security/advisories`

---

## ISO/IEC 29147 + 30111 — Coordinated Vulnerability Disclosure (CVD)

### ISO/IEC 29147:2018 — Outward-facing disclosure process

Defines how a project receives and handles vulnerability reports from external parties:

1. **Intake** — dedicated channel (GitHub PVR, security email, HackerOne); acknowledge within stated SLA
2. **Acknowledgement** — confirm receipt, assign internal tracking ID
3. **Communication** — keep reporter informed of progress at agreed intervals
4. **Resolution** — provide fix or workaround
5. **Publication** — coordinated advisory with credit to reporter; CVSS score; CVE if applicable

### ISO/IEC 30111:2019 — Internal handling process

Defines what happens internally after a report is received:

1. **Verification** — reproduce and confirm the vulnerability
2. **Prioritization** — CVSS scoring; exploit availability; affected versions
3. **Fix development and testing** — private branch; regression tests
4. **Deployment** — release and distribution to affected users
5. **Post-release** — root cause analysis; process improvements

### Embargo / Disclosure Timeline

- Acknowledgement: ≤5 business days (Node.js model: 5 days)
- Detailed response: ≤10 days
- Coordinated disclosure embargo: ≤90 days (industry standard; CERT/CC guideline)
- For critical zero-days with active exploitation: may disclose before fix is available
- Publish blog advisory within 6 hours of mailing-list notification (Node.js model)

---

## NIST SSDF (SP 800-218) — RV Group Documentation Requirements

The Respond to Vulnerabilities (RV) group defines what must be documented about vulnerability management:

| Practice | Task | Documentation required |
|----------|------|----------------------|
| RV.1 | Identify and confirm vulnerabilities | Document vulnerability triage process and severity criteria |
| RV.2 | Assess, prioritize, and remediate vulnerabilities | Document remediation SLAs by severity (critical/high/medium/low) |
| RV.3 | Analyze vulnerabilities to identify root causes | Document root cause analysis process; blameless retrospective template |

SP 800-218A (AI profile, per EO 14110) adds requirements for AI/ML model development pipelines — relevant if the MCP server includes model inference.

---

## RFC 9116 — security.txt Required Fields

`security.txt` must be placed at `/.well-known/security.txt` and served over HTTPS.

**Required fields:**

```
Contact: https://github.com/<org>/<repo>/security/advisories/new
# OR: mailto:security@example.com

Policy: https://github.com/<org>/<repo>/blob/main/SECURITY.md

Expires: <RFC 3339 datetime, ≤1 year from creation>
# Example: Expires: 2027-06-09T00:00:00Z
```

**Recommended fields:**

```
Preferred-Languages: en
Acknowledgments: https://github.com/<org>/<repo>/blob/main/SECURITY.md#acknowledgements
Canonical: https://<your-domain>/.well-known/security.txt
```

**Rules:**
- `Expires` must be no more than 1 year in the future; scanners treat expired files as absent
- Multiple `Contact` fields are allowed; list in preference order
- The file must be signed with PGP if a `Encryption` key is listed

---

## OpenSSF Security Insights v2.2.0 — File Structure

**Filename:** `security-insights.yml` (lowercase; the uppercase `SECURITY-INSIGHTS.yml` is the deprecated v1.x convention)
**Location:** repo root or `.github/`

Top-level structure:
```yaml
header:
  schema-version: "2.2.0"
  project-url: https://github.com/org/repo
  changelog-url: https://github.com/org/repo/blob/main/CHANGELOG.md

project:
  vulnerability-reporting:
    reports-accepted: true
    bug-bounty-available: false
    contact:
      - mailto:security@example.com
      - https://github.com/org/repo/security/advisories/new
    policy: https://github.com/org/repo/blob/main/SECURITY.md
    in-scope:
      - This MCP server's transport, tools, and authentication
    out-of-scope:
      - Third-party dependencies
      - Host operating system
  documentation:
    quickstart-guide: https://github.com/org/repo/blob/main/README.md
    release-process: https://github.com/org/repo/blob/main/docs/release-process.md

repository:
  documentation:
    contributing-guide: https://github.com/org/repo/blob/main/CONTRIBUTING.md
    security-policy: https://github.com/org/repo/blob/main/SECURITY.md
  security:
    assessments: []   # fill with URLs to security assessment documents
    champions:
      - name: <PLACEHOLDER: Security Champion Name>
        primary: true
    tools: []
```

Consumed by: CLOMonitor (CNCF), LFX Insights (Linux Foundation), si-tooling (OpenSSF).
LFX Insights scores this file directly against OSPS Baseline controls.
