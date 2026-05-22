#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-auth.ts <src-dir>
// Output: newline-delimited JSON findings { code, severity, file, line, message, fix }

import * as fs from 'node:fs';
import * as path from 'node:path';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
interface Finding { code: string; severity: Severity; file: string; line: number; message: string; fix: string; }

const findings: Finding[] = [];
function emit(f: Finding) { findings.push(f); process.stdout.write(JSON.stringify(f) + '\n'); }

function collectTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectTs(full));
    else if (entry.name.endsWith('.ts')) results.push(full);
  }
  return results;
}

const srcDir = path.resolve(process.argv[2] ?? '.');
const files = collectTs(srcDir);

// Aggregate flags set by multi-file checks
let hasGuardsInMcpModule = false;
let hasPrmEndpoint = false;
let jwtSecretLength: number | undefined;

for (const filePath of files) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  // A001: McpModule.forRoot with no guards array
  if (/McpModule\.forRoot\(/.test(src) && !/guards\s*:/.test(src)) {
    hasGuardsInMcpModule = false;
    emit({
      code: 'A001', severity: 'CRITICAL', file: filePath, line: 1,
      message: 'McpModule.forRoot has no guards array — all MCP endpoints are unauthenticated.',
      fix: "Add guards: [JwtGuard] (or equivalent) to McpModule.forRoot options.",
    });
  } else if (/McpModule\.forRoot\(/.test(src) && /guards\s*:/.test(src)) {
    hasGuardsInMcpModule = true;
  }

  // A003: PRM endpoint presence
  if (/oauth-protected-resource/.test(src)) hasPrmEndpoint = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // A002: write/destructive tool missing @ToolScopes
    if (/@Tool\s*\(/.test(line)) {
      const block = lines.slice(i, i + 40).join('\n');
      const isDestructive = /destructiveHint\s*:\s*true/.test(block) || /delete|remove|drop|purge/i.test(block);
      const hasScopes = /@ToolScopes\s*\(/.test(lines.slice(Math.max(0, i - 3), i + 2).join('\n'));
      if (isDestructive && !hasScopes) {
        emit({
          code: 'A002', severity: 'HIGH', file: filePath, line: lineNum,
          message: 'Destructive tool appears to lack @ToolScopes authorization.',
          fix: "Add @ToolScopes(['<resource>:delete']) or @ToolRoles(['admin']) above @Tool.",
        });
      }
    }

    // A004: token pass-through — forwarding client Authorization header to upstream
    if (/Authorization\s*:\s*(clientToken|req\.headers\.authorization|ctx\.request.*authorization)/i.test(line)
        && /fetch\(|axios\.|got\.|https?\./i.test(lines.slice(i, i + 5).join('\n'))) {
      emit({
        code: 'A004', severity: 'CRITICAL', file: filePath, line: lineNum,
        message: 'Possible client token forwarded to upstream API.',
        fix: 'Obtain a separate upstream token via client-credentials flow. Never forward the client token.',
      });
    }

    // A005: JWT_SECRET under 32 chars
    const secretMatch = line.match(/JWT_SECRET\s*[=:]\s*['"`]([^'"`]+)['"`]/);
    if (secretMatch && secretMatch[1].length < 32) {
      jwtSecretLength = secretMatch[1].length;
      emit({
        code: 'A005', severity: 'HIGH', file: filePath, line: lineNum,
        message: `JWT_SECRET is only ${secretMatch[1].length} characters — minimum is 32.`,
        fix: 'Generate with: openssl rand -base64 32. Store in environment variable, not source.',
      });
    }

    // A006: JWT validation without audience check
    if (/PassportStrategy|verify\s*\(token/.test(line)) {
      const strategyBlock = lines.slice(i, i + 30).join('\n');
      if (!strategyBlock.includes('audience') && !strategyBlock.includes('aud')) {
        emit({
          code: 'A006', severity: 'HIGH', file: filePath, line: lineNum,
          message: 'JWT strategy/verification appears to be missing audience (aud) claim check.',
          fix: "Add audience: cfg.getOrThrow('MCP_RESOURCE_URI') to PassportStrategy options.",
        });
      }
    }
  }
}

// A003: no PRM endpoint found anywhere
if (!hasPrmEndpoint) {
  emit({
    code: 'A003', severity: 'HIGH', file: srcDir, line: 0,
    message: 'No /.well-known/oauth-protected-resource endpoint found in the codebase.',
    fix: "Add PrmMetadataController from assets/prm-metadata.template.ts.",
  });
}

process.stderr.write(`\nAudited ${files.length} file(s). Found ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
