#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-observability.ts <src-dir>
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

let tracingIsFirst = false;
let hasAuditInterceptor = false;
let hasHealthSkipThrottle = false;
let hasHealthPublic = false;
let hasShutdownHooks = false;
let hasRedactPaths = false;
let hasOtelInEnvSchema = false;

// Check main.ts specifically for import order
const mainTs = files.find(f => f.endsWith('main.ts'));
if (mainTs) {
  const mainSrc = fs.readFileSync(mainTs, 'utf8');
  const firstImport = mainSrc.match(/^import\s+/m);
  if (firstImport) {
    const firstLine = mainSrc.split('\n').findIndex(l => /^import\s+/.test(l));
    const tracingLine = mainSrc.split('\n').findIndex(l => /tracing/.test(l));
    if (tracingLine >= 0 && tracingLine <= firstLine + 1) {
      tracingIsFirst = true;
    }
  }
  if (!tracingIsFirst && /tracing/.test(mainSrc)) {
    const tracingLineNum = mainSrc.split('\n').findIndex(l => /tracing/.test(l)) + 1;
    emit({
      code: 'O001', severity: 'HIGH', file: mainTs, line: tracingLineNum,
      message: "tracing.ts is not the first import in main.ts — spans will be lost for all modules imported before it.",
      fix: "Move 'import \"./observability/tracing\"' to line 1 of main.ts, before any other imports.",
    });
  } else if (!/tracing/.test(mainSrc)) {
    emit({
      code: 'O001', severity: 'HIGH', file: mainTs, line: 1,
      message: "No tracing.ts import found in main.ts — OpenTelemetry is not initialised.",
      fix: "Add 'import \"./observability/tracing\"' as the first line of main.ts. See assets/tracing.template.ts.",
    });
  }

  if (/enableShutdownHooks/.test(mainSrc)) hasShutdownHooks = true;
}

for (const filePath of files) {
  const src = fs.readFileSync(filePath, 'utf8');

  if (/AuditInterceptor/.test(src) && /APP_INTERCEPTOR/.test(src)) hasAuditInterceptor = true;
  if (/SkipThrottle.*healthz|healthz.*SkipThrottle|SkipThrottle.*readyz/.test(src)) hasHealthSkipThrottle = true;
  if (/@Public\(\)/.test(src) && /healthz|readyz/.test(src)) hasHealthPublic = true;
  if (/redact\s*:/.test(src) && /paths\s*:/.test(src)) hasRedactPaths = true;
  if (/OTEL_/.test(src) && /z\.string/.test(src)) hasOtelInEnvSchema = true;

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // O002: sensitive field missing from redact paths
    const SENSITIVE_FIELDS = ['authorization', 'password', 'token', 'secret', 'api_key'];
    if (/redact\s*:/.test(line)) {
      const redactBlock = lines.slice(i, i + 25).join('\n');
      for (const field of SENSITIVE_FIELDS) {
        if (!redactBlock.toLowerCase().includes(field)) {
          emit({
            code: 'O002', severity: 'HIGH', file: filePath, line: i + 1,
            message: `Pino redact config may be missing '${field}' — sensitive data may appear in logs.`,
            fix: `Add '*.${field}' and 'req.headers.${field}' to the redact.paths array.`,
          });
          break;  // one finding per redact block is enough
        }
      }
    }
  }
}

if (!hasAuditInterceptor) {
  emit({
    code: 'O003', severity: 'HIGH', file: srcDir, line: 0,
    message: 'No AuditInterceptor registered as APP_INTERCEPTOR — tool calls are not audited.',
    fix: 'Add AuditInterceptor from assets/audit.interceptor.template.ts. Register as { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }.',
  });
}

if (!hasHealthSkipThrottle || !hasHealthPublic) {
  emit({
    code: 'O004', severity: 'MEDIUM', file: srcDir, line: 0,
    message: 'Health endpoints may not be excluded from JWT auth or rate-limiting guards.',
    fix: 'Add @SkipThrottle() and @Public() (or equivalent) to HealthController.',
  });
}

if (!hasShutdownHooks) {
  emit({
    code: 'O005', severity: 'MEDIUM', file: mainTs ?? srcDir, line: 0,
    message: 'app.enableShutdownHooks() not found — in-flight requests will not be drained on SIGTERM.',
    fix: "Add app.enableShutdownHooks() after NestFactory.create in main.ts.",
  });
}

if (!hasOtelInEnvSchema) {
  emit({
    code: 'O006', severity: 'LOW', file: srcDir, line: 0,
    message: 'OTEL_ env vars not found in Zod env schema — missing values fail silently.',
    fix: "Add OTEL_SERVICE_NAME and OTEL_EXPORTER_OTLP_ENDPOINT to the Zod env schema.",
  });
}

process.stderr.write(`\nAudited ${files.length} file(s). Found ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
