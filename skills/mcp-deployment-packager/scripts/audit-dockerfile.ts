#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-dockerfile.ts <Dockerfile>
// Also audits K8s YAML files in the same directory if found.
// Output: newline-delimited JSON findings { code, severity, file, line, message, fix }

import * as fs from 'node:fs';
import * as path from 'node:path';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
interface Finding { code: string; severity: Severity; file: string; line: number; message: string; fix: string; }

const findings: Finding[] = [];
function emit(f: Finding) { findings.push(f); process.stdout.write(JSON.stringify(f) + '\n'); }

const dockerfilePath = process.argv[2];
if (!dockerfilePath || !fs.existsSync(dockerfilePath)) {
  process.stderr.write('Usage: npx ts-node scripts/audit-dockerfile.ts <Dockerfile>\n');
  process.exit(1);
}

function auditDockerfile(filePath: string) {
  const src   = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  let hasUserInstruction  = false;
  let hasHealthcheck      = false;
  let hasMultiStage       = false;
  let fromCount           = 0;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i].trim();
    const lineNum = i + 1;

    // Count FROM instructions for multi-stage detection
    if (/^FROM\s/i.test(line)) {
      fromCount++;
      if (fromCount > 1) hasMultiStage = true;

      // D003: :latest tag
      if (/:latest\b/.test(line) || /^FROM\s+\S+$/.test(line.replace(/\s+AS\s+\S+/i, ''))) {
        // Check if image has no tag at all (implies latest)
        const imageRef = line.replace(/^FROM\s+/i, '').replace(/\s+AS\s+\S+/i, '').trim();
        if (imageRef.endsWith(':latest') || (!imageRef.includes(':') && !imageRef.includes('@'))) {
          emit({
            code: 'D003', severity: 'HIGH', file: filePath, line: lineNum,
            message: `Base image '${imageRef}' uses :latest or no tag — builds are not reproducible.`,
            fix: 'Pin to a specific minor version (e.g., node:22.15-slim) or a digest.',
          });
        }
      }
    }

    // D001: USER instruction detection
    if (/^USER\s/i.test(line)) hasUserInstruction = true;

    // D002: HEALTHCHECK detection
    if (/^HEALTHCHECK\s/i.test(line) && !/^HEALTHCHECK\s+NONE/i.test(line)) hasHealthcheck = true;

    // D004: secret in ENV instruction
    const secretPattern = /^ENV\s+.*(SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|TOKEN|PRIVATE_KEY)\s*=/i;
    if (secretPattern.test(line)) {
      emit({
        code: 'D004', severity: 'CRITICAL', file: filePath, line: lineNum,
        message: 'Secret value embedded in ENV instruction — visible in image layers and `docker inspect`.',
        fix: 'Remove from Dockerfile. Inject secrets at runtime via K8s secretKeyRef or Docker --env-file.',
      });
    }
  }

  if (!hasUserInstruction) {
    emit({
      code: 'D001', severity: 'CRITICAL', file: filePath, line: lines.length,
      message: 'No USER instruction found — container runs as root.',
      fix: 'Add: RUN groupadd -r -g 1001 mcp && useradd -r -u 1001 -g mcp mcp\n       USER 1001',
    });
  }

  if (!hasHealthcheck) {
    emit({
      code: 'D002', severity: 'HIGH', file: filePath, line: lines.length,
      message: 'No HEALTHCHECK instruction — container orchestrators cannot detect unhealthy processes.',
      fix: 'Add: HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD curl -sf http://localhost:3000/healthz || exit 1',
    });
  }

  if (!hasMultiStage) {
    emit({
      code: 'D005', severity: 'MEDIUM', file: filePath, line: 1,
      message: 'Single-stage Dockerfile — dev tools and source code may be in the runtime image.',
      fix: 'Split into builder (compile) and runtime (minimal base + dist/ only) stages.',
    });
  }
}

function auditK8sManifest(filePath: string) {
  const src   = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  let hasLiveness  = false;
  let hasReadiness = false;

  for (const line of lines) {
    if (/livenessProbe\s*:/.test(line))  hasLiveness  = true;
    if (/readinessProbe\s*:/.test(line)) hasReadiness = true;
  }

  if (!hasLiveness || !hasReadiness) {
    emit({
      code: 'D006', severity: 'HIGH', file: filePath, line: 1,
      message: `K8s Deployment missing ${!hasLiveness ? 'livenessProbe' : ''}${!hasLiveness && !hasReadiness ? ' and ' : ''}${!hasReadiness ? 'readinessProbe' : ''}.`,
      fix: 'Add livenessProbe (/healthz) and readinessProbe (/readyz) to the container spec.',
    });
  }
}

auditDockerfile(dockerfilePath);

// Also audit K8s YAML in the same directory
const dir = path.dirname(path.resolve(dockerfilePath));
for (const entry of fs.readdirSync(dir)) {
  if ((entry.endsWith('.yaml') || entry.endsWith('.yml')) && /k8s|deploy|manifest/i.test(entry)) {
    auditK8sManifest(path.join(dir, entry));
  }
}

process.stderr.write(`\nFound ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
