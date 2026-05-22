#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-tools.ts <src-dir>
// Output: newline-delimited JSON — one finding object per line
// Each finding: { code, severity, file, line, message, fix }

import * as fs from 'node:fs';
import * as path from 'node:path';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Finding {
  code: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  fix: string;
}

const findings: Finding[] = [];

function emit(f: Finding) {
  findings.push(f);
  process.stdout.write(JSON.stringify(f) + '\n');
}

function collectTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectTs(full));
    else if (entry.name.endsWith('.ts')) results.push(full);
  }
  return results;
}

function auditFile(filePath: string) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  // Find @Tool decorator blocks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // T001: @Tool missing description
    if (/@Tool\s*\(/.test(line)) {
      const block = lines.slice(i, i + 30).join('\n');
      if (!block.includes('description:') || /description:\s*['"`]\s*['"`]/.test(block)) {
        emit({
          code: 'T001',
          severity: 'HIGH',
          file: filePath,
          line: lineNum,
          message: '@Tool decorator is missing a non-empty description field.',
          fix: "Add description: 'One sentence describing what the tool does and what inputs it expects.'",
        });
      }

      // T003: write tool missing destructiveHint and idempotentHint
      const hasReadOnly = /readOnlyHint\s*:\s*true/.test(block);
      const hasDestructive = /destructiveHint/.test(block);
      const hasIdempotent = /idempotentHint/.test(block);
      if (!hasReadOnly && (!hasDestructive || !hasIdempotent)) {
        emit({
          code: 'T003',
          severity: 'CRITICAL',
          file: filePath,
          line: lineNum,
          message: 'Write tool is missing destructiveHint and/or idempotentHint annotation.',
          fix: 'Add explicit destructiveHint and idempotentHint to the annotations object.',
        });
      }

      // T006: tool name not namespaced
      const nameMatch = block.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
      if (nameMatch && !nameMatch[1].includes('_')) {
        emit({
          code: 'T006',
          severity: 'LOW',
          file: filePath,
          line: lineNum,
          message: `Tool name '${nameMatch[1]}' is not namespaced (no underscore).`,
          fix: "Prefix with domain: e.g. 'customers_search' instead of 'search'.",
        });
      }
    }

    // T002: Zod field missing .describe()
    if (/z\.(string|number|boolean|enum|array|object)\(/.test(line) && !line.includes('.describe(')) {
      // Skip lines that are continuations (method chain on next line)
      const nextLine = lines[i + 1] ?? '';
      if (!nextLine.trim().startsWith('.describe(')) {
        emit({
          code: 'T002',
          severity: 'HIGH',
          file: filePath,
          line: lineNum,
          message: 'Zod schema field appears to be missing .describe().',
          fix: "Add .describe('Plain English description with one concrete example') to this field.",
        });
      }
    }

    // T004: business error thrown instead of returned
    if (/throw\s+new\s+Error\(/.test(line) || /throw\s+new\s+NotFoundException\(/.test(line)) {
      emit({
        code: 'T004',
        severity: 'HIGH',
        file: filePath,
        line: lineNum,
        message: 'Possible business error thrown instead of returned as isError: true.',
        fix: "Return { content: [{ type: 'text', text: reason }], isError: true } for domain failures.",
      });
    }

    // T005: openWorldHint: false but outbound HTTP present
    if (/openWorldHint\s*:\s*false/.test(line)) {
      const methodBlock = lines.slice(Math.max(0, i - 5), i + 50).join('\n');
      if (/fetch\(|axios\.|got\.|https?\.get|http\.request/.test(methodBlock)) {
        emit({
          code: 'T005',
          severity: 'MEDIUM',
          file: filePath,
          line: lineNum,
          message: 'Tool declares openWorldHint: false but appears to make outbound HTTP calls.',
          fix: 'Set openWorldHint: true if the tool calls external APIs or the internet.',
        });
      }
    }

    // T007: args concatenated into shell/SQL
    if (/exec\s*\(`/.test(line) || /query\s*\+/.test(line) || /\$\{.*args\./.test(line)) {
      emit({
        code: 'T007',
        severity: 'CRITICAL',
        file: filePath,
        line: lineNum,
        message: 'Possible tool argument concatenated into shell command or SQL string.',
        fix: 'Use execFile(cmd, [arg]) for shell; parameterised queries for SQL. Never interpolate user input.',
      });
    }
  }
}

// Main
const srcDir = process.argv[2];
if (!srcDir) {
  process.stderr.write('Usage: npx ts-node scripts/audit-tools.ts <src-dir>\n');
  process.exit(1);
}

const files = collectTs(path.resolve(srcDir));
for (const f of files) {
  auditFile(f);
}

process.stderr.write(`\nAudited ${files.length} file(s). Found ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
