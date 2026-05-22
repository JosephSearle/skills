#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-security.ts <src-dir>
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

let hasHostValidation = false;

for (const filePath of files) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  // S001 detection flag
  if (/HostValidatorMiddleware|host.*allowlist|origin.*allowlist/i.test(src)) hasHostValidation = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // S002: wildcard CORS
    if (/enableCors\s*\(\s*\{/.test(line) || /origin\s*:\s*['"`]\*['"`]/.test(line)) {
      const block = lines.slice(i, i + 15).join('\n');
      if (/origin\s*:\s*['"`]\*['"`]/.test(block)) {
        emit({
          code: 'S002', severity: 'HIGH', file: filePath, line: lineNum,
          message: 'CORS configured with wildcard origin ("*") — any website can call this API.',
          fix: 'Use a function origin that checks against CORS_ALLOWED_ORIGINS env var. See assets/cors.template.ts.',
        });
      }
    }

    // S003: exec() with template literal or string concat (command injection)
    if (/\bexec\s*\(`/.test(line) || /\bexec\s*\(.*\+/.test(line) || /\bexec\s*\(.*args\./.test(line)) {
      emit({
        code: 'S003', severity: 'CRITICAL', file: filePath, line: lineNum,
        message: 'child_process.exec() called with dynamic string — shell injection risk.',
        fix: 'Replace with execFile(cmd, [arg1, arg2]) to avoid shell metacharacter interpretation.',
      });
    }

    // S003b: exec called anywhere — flag for review
    if (/child_process.*exec\b/.test(line) && !line.includes('execFile')) {
      emit({
        code: 'S003', severity: 'CRITICAL', file: filePath, line: lineNum,
        message: 'child_process.exec() usage detected — review for user-controlled input.',
        fix: 'Replace with execFile(cmd, argv) unless input is fully hardcoded.',
      });
    }

    // S004: URL tool arg without SSRF guard
    if (/z\.string\(\).*\.url\(\)/.test(line)) {
      const toolBlock = lines.slice(Math.max(0, i - 10), i + 50).join('\n');
      const hasFetch = /fetch\(|axios\.|got\.|https?\./.test(toolBlock);
      const hasGuard = /isPrivateIP|safeFetch|SSRF|private.*address/i.test(toolBlock);
      if (hasFetch && !hasGuard) {
        emit({
          code: 'S004', severity: 'HIGH', file: filePath, line: lineNum,
          message: 'Tool accepts URL argument and makes HTTP requests without SSRF guard.',
          fix: 'Implement safeFetch() that resolves DNS and blocks private IP ranges. See references/injection-prevention.md.',
        });
      }
    }

    // S005: upstream API response injected into tool content without sanitisation
    if (/content.*type.*text.*text.*response\.|\.body\s*\}/.test(line)) {
      const block = lines.slice(Math.max(0, i - 3), i + 3).join('\n');
      if (!/sanitise|sanitize|strip|escape/i.test(block)) {
        emit({
          code: 'S005', severity: 'HIGH', file: filePath, line: lineNum,
          message: 'Possible unsanitised upstream API response included in tool content.',
          fix: 'Wrap in sanitiseForLlm() before including in content. See references/injection-prevention.md.',
        });
      }
    }

    // S006: 0.0.0.0 binding without Host validation
    if (/listen\s*\(.*0\.0\.0\.0/.test(line) || /listen\s*\(\s*port\s*\)/.test(line)) {
      if (!hasHostValidation) {
        emit({
          code: 'S006', severity: 'MEDIUM', file: filePath, line: lineNum,
          message: 'Server may be bound to 0.0.0.0 without Host header validation.',
          fix: 'Add HostValidatorMiddleware (see assets/host-validator.middleware.ts) or bind to 127.0.0.1 in development.',
        });
      }
    }
  }
}

// S001: no Host validation found anywhere
if (!hasHostValidation) {
  emit({
    code: 'S001', severity: 'CRITICAL', file: srcDir, line: 0,
    message: 'No Host or Origin header validation found — server is vulnerable to DNS rebinding.',
    fix: 'Add HostValidatorMiddleware from assets/host-validator.middleware.ts to the /mcp route.',
  });
}

process.stderr.write(`\nAudited ${files.length} file(s). Found ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
