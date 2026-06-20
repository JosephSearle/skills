#!/usr/bin/env npx ts-node
/**
 * Audit script for mcp-security-docs skill.
 *
 * Usage:
 *   npx ts-node scripts/audit-security-docs.ts <project-root>
 *   npx ts-node scripts/audit-security-docs.ts .
 *
 * Output:
 *   - One NDJSON finding per line (for machine consumption)
 *   - Followed by a human-readable Markdown summary
 *
 * This script is READ-ONLY — it never modifies any files.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Finding {
  code: string;
  severity: Severity;
  control: string;
  file: string;
  finding: string;
  fix: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exists(root: string, ...segments: string[]): boolean {
  return fs.existsSync(path.join(root, ...segments));
}

function readFile(root: string, ...segments: string[]): string | null {
  const filePath = path.join(root, ...segments);
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function contains(content: string | null, ...terms: string[]): boolean {
  if (!content) return false;
  return terms.every(term => content.toLowerCase().includes(term.toLowerCase()));
}

function containsAny(content: string | null, ...terms: string[]): boolean {
  if (!content) return false;
  return terms.some(term => content.toLowerCase().includes(term.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

function auditSecurityMd(root: string, findings: Finding[]): void {
  const candidates = [
    readFile(root, 'SECURITY.md'),
    readFile(root, '.github', 'SECURITY.md'),
    readFile(root, 'docs', 'SECURITY.md'),
  ];
  const content = candidates.find(c => c !== null) ?? null;
  const foundAt = exists(root, 'SECURITY.md') ? 'SECURITY.md'
    : exists(root, '.github', 'SECURITY.md') ? '.github/SECURITY.md'
    : exists(root, 'docs', 'SECURITY.md') ? 'docs/SECURITY.md'
    : null;

  if (!content) {
    findings.push({
      code: 'SEC-001',
      severity: 'CRITICAL',
      control: 'OSPS VM-02.01 (L1)',
      file: 'SECURITY.md',
      finding: 'SECURITY.md not found at root, .github/, or docs/',
      fix: 'Run mcp-security-docs GENERATE mode to create SECURITY.md from the template.',
    });
    return;
  }

  const file = foundAt!;

  // Supported versions table
  if (!contains(content, 'supported version', '|')) {
    findings.push({
      code: 'SEC-002',
      severity: 'HIGH',
      control: 'OSPS DO-04.01 (L3) / best practice',
      file,
      finding: 'SECURITY.md has no supported versions table',
      fix: 'Add a Markdown table listing which version lines receive security fixes.',
    });
  }

  // Private reporting channel
  if (!containsAny(content, 'github.com', 'security/advisories', 'mailto:', 'hackerone', 'bugcrowd')) {
    findings.push({
      code: 'SEC-003',
      severity: 'CRITICAL',
      control: 'OSPS VM-03.01 (L2)',
      file,
      finding: 'SECURITY.md does not reference a private vulnerability reporting channel',
      fix: 'Enable GitHub Private Vulnerability Reporting and add the advisories/new URL to SECURITY.md.',
    });
  }

  // Acknowledgement SLA
  if (!containsAny(content, '5 business days', '5 days', 'acknowledge', 'acknowledgement', 'acknowledgment')) {
    findings.push({
      code: 'SEC-004',
      severity: 'MEDIUM',
      control: 'OSPS VM-01.01 (L2)',
      file,
      finding: 'SECURITY.md does not state an acknowledgement SLA (e.g., "within 5 business days")',
      fix: 'Add a Response Timeline section with explicit acknowledgement and detailed-response timeframes.',
    });
  }

  // Coordinated disclosure / embargo
  if (!containsAny(content, 'coordinated disclosure', 'responsible disclosure', 'embargo', '90 day')) {
    findings.push({
      code: 'SEC-005',
      severity: 'MEDIUM',
      control: 'OSPS VM-01.01 (L2) / ISO 29147',
      file,
      finding: 'SECURITY.md does not describe a coordinated disclosure policy or embargo period',
      fix: 'Add a Coordinated Disclosure Policy section stating the embargo period (≤90 days).',
    });
  }

  // Scope section
  if (!containsAny(content, 'in scope', 'out of scope', '## scope')) {
    findings.push({
      code: 'SEC-006',
      severity: 'LOW',
      control: 'Best practice',
      file,
      finding: 'SECURITY.md has no Scope section defining what is in/out of scope for reports',
      fix: 'Add a Scope section listing in-scope components (transport, tools, auth) and out-of-scope items.',
    });
  }
}

function auditMcpThreatModel(root: string, findings: Finding[]): void {
  // Check SECURITY.md for MCP threat model summary
  const secContent = readFile(root, 'SECURITY.md')
    ?? readFile(root, '.github', 'SECURITY.md')
    ?? readFile(root, 'docs', 'SECURITY.md');

  const hasSecMcpSection = secContent
    ? containsAny(secContent, 'tool poisoning', 'mcp threat', 'token passthrough', 'prompt injection')
    : false;

  if (!hasSecMcpSection) {
    findings.push({
      code: 'MCP-01',
      severity: 'CRITICAL',
      control: 'MCP spec 2025-11-25 / OWASP Agentic ASI01',
      file: 'SECURITY.md',
      finding: 'SECURITY.md has no MCP Threat Model Summary section (tool poisoning, token passthrough not documented)',
      fix: 'Add a "MCP Threat Model Summary" section to SECURITY.md covering tool poisoning, prompt injection, and OAuth token audience enforcement. Link to docs/security/threat-model.md.',
    });
  }

  // Check for dedicated threat model doc
  const tmContent = readFile(root, 'docs', 'security', 'threat-model.md');
  if (!tmContent) {
    findings.push({
      code: 'MCP-02',
      severity: 'HIGH',
      control: 'OSPS SA-03.02 (L3) / MCP spec',
      file: 'docs/security/threat-model.md',
      finding: 'docs/security/threat-model.md not found — no dedicated STRIDE threat model for this MCP server',
      fix: 'Run mcp-security-docs GENERATE mode at L2+ to create threat-model.md from the template.',
    });
    return;
  }

  // Token passthrough
  if (!contains(tmContent, 'token passthrough')) {
    findings.push({
      code: 'MCP-03',
      severity: 'CRITICAL',
      control: 'MCP spec 2025-11-25 (token passthrough is forbidden)',
      file: 'docs/security/threat-model.md',
      finding: 'Threat model does not document token passthrough policy (token passthrough is forbidden by MCP spec)',
      fix: 'Add a "Token Passthrough" row to the threat model stating this server never forwards inbound tokens to downstream services.',
    });
  }

  // OAuth 2.1 / audience binding
  if (!containsAny(tmContent, 'aud', 'audience', 'rfc 8707', 'resource indicator')) {
    findings.push({
      code: 'MCP-04',
      severity: 'CRITICAL',
      control: 'MCP spec 2025-11-25 / RFC 8707',
      file: 'docs/security/threat-model.md',
      finding: 'Threat model does not document OAuth audience (aud) claim enforcement or RFC 8707 Resource Indicators',
      fix: 'Add audience binding to the Auth Layer threat table: "aud claim validated against registered resource identifier; RFC 8707 resource indicators required."',
    });
  }

  // Confused-deputy
  if (!containsAny(tmContent, 'confused-deputy', 'confused deputy', 'per-client consent', 'redirect-uri')) {
    findings.push({
      code: 'MCP-05',
      severity: 'HIGH',
      control: 'MCP spec 2025-11-25 (confused-deputy mitigations)',
      file: 'docs/security/threat-model.md',
      finding: 'Threat model does not document confused-deputy mitigations (per-client consent, redirect-URI matching)',
      fix: 'Add confused-deputy mitigations to the threat model: per-client consent, exact redirect-URI matching, state-parameter validation, __Host- cookies.',
    });
  }

  // Tool poisoning mitigations
  if (!containsAny(tmContent, 'tool poisoning', 'tool description', 'egress allowlist', 'immutable')) {
    findings.push({
      code: 'MCP-06',
      severity: 'HIGH',
      control: 'OWASP Agentic ASI01 / OWASP LLM01',
      file: 'docs/security/threat-model.md',
      finding: 'Threat model does not document tool poisoning mitigations (static descriptions, egress allowlist)',
      fix: 'Add a Tool Poisoning section documenting: static tool descriptions, immutable Zod schemas, egress allowlist, IMDS blocklist.',
    });
  }

  // Audit logging
  if (!containsAny(tmContent, 'audit log', 'siem', 'audit trail')) {
    findings.push({
      code: 'MCP-07',
      severity: 'MEDIUM',
      control: 'CIS Control 8 / MCP security best practices',
      file: 'docs/security/threat-model.md',
      finding: 'Threat model does not document audit logging policy for tool calls',
      fix: 'Add an audit logging row: state-changing tool calls logged with tool name, caller sub, args hash, timestamp; shipped to SIEM.',
    });
  }

  // CVE-2025-49596 / dev tooling auth
  if (!containsAny(tmContent, 'mcp inspector', 'cve-2025-49596', 'dev tooling', 'developer tooling')) {
    findings.push({
      code: 'MCP-08',
      severity: 'LOW',
      control: 'CVE-2025-49596 (CVSS 9.4)',
      file: 'docs/security/threat-model.md or SECURITY.md',
      finding: 'No mention of MCP Inspector authentication requirement (ref: CVE-2025-49596)',
      fix: 'Add a note in SECURITY.md Scope or threat model: "MCP Inspector ≥0.14.1 required; must run authenticated on a non-public port."',
    });
  }
}

function auditSecurityInsights(root: string, findings: Finding[]): void {
  const candidates = [
    { path: 'security-insights.yml', content: readFile(root, 'security-insights.yml') },
    { path: '.github/security-insights.yml', content: readFile(root, '.github', 'security-insights.yml') },
  ];

  const found = candidates.find(c => c.content !== null);

  if (!found) {
    findings.push({
      code: 'SEC-007',
      severity: 'MEDIUM',
      control: 'OSPS SA-03.01 (L2) / OpenSSF Security Insights v2.2.0',
      file: 'security-insights.yml',
      finding: 'security-insights.yml not found at root or .github/',
      fix: 'Run mcp-security-docs GENERATE mode at L2+ to create security-insights.yml from the template.',
    });
    return;
  }

  const { path: filePath, content } = found;

  // Schema version check
  if (!contains(content, 'schema-version: "2.2.0"') && !contains(content, "schema-version: '2.2.0'")) {
    if (containsAny(content, 'SECURITY-INSIGHTS.yml', 'schema-version: "1.', "schema-version: '1.")) {
      findings.push({
        code: 'SEC-008',
        severity: 'HIGH',
        control: 'OpenSSF Security Insights v2.2.0',
        file: filePath,
        finding: 'security-insights.yml appears to be using the deprecated v1.x schema (uppercase filename or old schema version)',
        fix: 'Migrate to security-insights.yml v2.2.0: lowercase filename, schema-version: "2.2.0", updated field structure.',
      });
    } else {
      findings.push({
        code: 'SEC-009',
        severity: 'MEDIUM',
        control: 'OpenSSF Security Insights v2.2.0',
        file: filePath,
        finding: 'security-insights.yml does not contain schema-version: "2.2.0"',
        fix: 'Set header.schema-version to "2.2.0" (string, not a number).',
      });
    }
  }

  // reports-accepted
  if (!contains(content, 'reports-accepted: true')) {
    findings.push({
      code: 'SEC-010',
      severity: 'MEDIUM',
      control: 'OSPS VM-03.01 (L2) / Security Insights spec',
      file: filePath,
      finding: 'security-insights.yml does not have vulnerability-reporting.reports-accepted: true',
      fix: 'Set project.vulnerability-reporting.reports-accepted to true.',
    });
  }

  // assessments field
  if (!contains(content, 'assessments:')) {
    findings.push({
      code: 'SEC-011',
      severity: 'MEDIUM',
      control: 'OSPS SA-03.01 (L2) / Security Insights spec',
      file: filePath,
      finding: 'security-insights.yml is missing the required repository.security.assessments field',
      fix: 'Add repository.security.assessments: [] (empty array is valid; fill with URLs when assessments exist).',
    });
  }
}

function auditGithubIntegration(root: string, findings: Finding[]): void {
  const secContent = readFile(root, 'SECURITY.md')
    ?? readFile(root, '.github', 'SECURITY.md')
    ?? readFile(root, 'docs', 'SECURITY.md');

  if (!secContent) return; // already reported as missing above

  // GitHub PVR link
  if (!contains(secContent, 'security/advisories')) {
    findings.push({
      code: 'GH-001',
      severity: 'HIGH',
      control: 'OSPS VM-03.01 (L2) / GitHub PVR',
      file: 'SECURITY.md',
      finding: 'SECURITY.md does not link to GitHub Private Vulnerability Reporting (security/advisories/new)',
      fix: 'Enable GitHub PVR (Settings → Security → Private vulnerability reporting → Enable) and add the URL to SECURITY.md.',
    });
  }
}

function auditCvdProcess(root: string, findings: Finding[]): void {
  const content = readFile(root, 'docs', 'security', 'vulnerability-disclosure.md');
  if (!content) {
    findings.push({
      code: 'SEC-012',
      severity: 'MEDIUM',
      control: 'OSPS VM-01.01 (L2) / ISO 29147 + 30111',
      file: 'docs/security/vulnerability-disclosure.md',
      finding: 'docs/security/vulnerability-disclosure.md not found — no documented CVD process',
      fix: 'Run mcp-security-docs GENERATE mode at L2+ to create vulnerability-disclosure.md from the template.',
    });
    return;
  }

  if (!containsAny(content, 'intake', 'acknowledgement', 'acknowledge')) {
    findings.push({
      code: 'SEC-013',
      severity: 'LOW',
      control: 'ISO 29147 / ISO 30111',
      file: 'docs/security/vulnerability-disclosure.md',
      finding: 'CVD process document does not describe the intake/acknowledgement phase',
      fix: 'Add an intake phase: receipt → assign tracking ID → acknowledge within 5 business days.',
    });
  }

  if (!containsAny(content, 'embargo', '90 day', 'coordinated disclosure', 'disclosure date')) {
    findings.push({
      code: 'SEC-014',
      severity: 'LOW',
      control: 'ISO 29147',
      file: 'docs/security/vulnerability-disclosure.md',
      finding: 'CVD process document does not state an embargo period',
      fix: 'Add embargo policy: maximum 90 days from acknowledgement; exceptions for active exploitation.',
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const projectRoot = process.argv[2];

  if (!projectRoot) {
    console.error('Usage: npx ts-node scripts/audit-security-docs.ts <project-root>');
    process.exit(1);
  }

  const resolvedRoot = path.resolve(projectRoot);

  if (!fs.existsSync(resolvedRoot)) {
    console.error(`Project root not found: ${resolvedRoot}`);
    process.exit(1);
  }

  const findings: Finding[] = [];

  auditSecurityMd(resolvedRoot, findings);
  auditMcpThreatModel(resolvedRoot, findings);
  auditSecurityInsights(resolvedRoot, findings);
  auditGithubIntegration(resolvedRoot, findings);
  auditCvdProcess(resolvedRoot, findings);

  // Output NDJSON findings
  for (const finding of findings) {
    process.stdout.write(JSON.stringify(finding) + '\n');
  }

  // Human-readable Markdown summary
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity]++;

  const verdictLine = counts.CRITICAL > 0 || counts.HIGH > 0
    ? '❌ FAIL'
    : counts.MEDIUM > 0
      ? '⚠️  NEEDS ATTENTION'
      : '✅ PASS';

  console.log('\n---');
  console.log(`## Security Documentation Audit — ${verdictLine}`);
  console.log(`\nProject: \`${resolvedRoot}\``);
  console.log(`\nFindings: ${counts.CRITICAL} CRITICAL, ${counts.HIGH} HIGH, ${counts.MEDIUM} MEDIUM, ${counts.LOW} LOW`);

  if (findings.length === 0) {
    console.log('\nNo findings. Security documentation meets all checked controls.');
    return;
  }

  console.log('\n| Code | Severity | Control | File | Finding |');
  console.log('|------|----------|---------|------|---------|');
  for (const f of findings) {
    console.log(`| ${f.code} | ${f.severity} | ${f.control} | \`${f.file}\` | ${f.finding} |`);
  }

  console.log('\n### Remediation Guidance\n');
  for (const f of findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
    console.log(`**${f.code} [${f.severity}]** — ${f.finding}`);
    console.log(`> Fix: ${f.fix}\n`);
  }
}

main();
