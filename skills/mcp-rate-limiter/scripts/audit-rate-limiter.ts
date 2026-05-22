#!/usr/bin/env npx ts-node --esm
// Usage: npx ts-node scripts/audit-rate-limiter.ts <src-dir>
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

let hasThrottler = false;
let hasRedisStorage = false;
let hasPerTokenTracker = false;
let hasSkipThrottleOnHealth = false;
let hasRedisInEnvSchema = false;

for (const filePath of files) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  if (/ThrottlerModule/.test(src)) hasThrottler = true;
  if (/ThrottlerStorageRedisService/.test(src)) hasRedisStorage = true;
  if (/getTracker/.test(src)) hasPerTokenTracker = true;
  if (/SkipThrottle\(\)/.test(src) && /healthz|readyz|health/i.test(src)) hasSkipThrottleOnHealth = true;
  if (/REDIS_URL/.test(src) && /z\.string|z\.url/.test(src)) hasRedisInEnvSchema = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // R004: missing Retry-After header
    if (/429|ThrottlerException|Too Many Requests/.test(line)) {
      const block = lines.slice(Math.max(0, i - 5), i + 10).join('\n');
      if (!/Retry-After|retryAfter/.test(block)) {
        emit({
          code: 'R004', severity: 'MEDIUM', file: filePath, line: lineNum,
          message: '429 response may be missing Retry-After header.',
          fix: "Override throwThrottlingException in ThrottlerGuard to include retryAfter. See references/rate-limit-headers.md.",
        });
      }
    }
  }
}

// R001: in-memory storage without explicit Redis (likely multi-instance)
if (hasThrottler && !hasRedisStorage) {
  emit({
    code: 'R001', severity: 'HIGH', file: srcDir, line: 0,
    message: 'ThrottlerModule configured without Redis storage — in-memory storage fails in multi-instance deployments.',
    fix: 'Add ThrottlerStorageRedisService from @nest-lab/throttler-storage-redis. See assets/throttler.template.ts.',
  });
}

// R002: health endpoints not excluded from throttling
if (hasThrottler && !hasSkipThrottleOnHealth) {
  emit({
    code: 'R002', severity: 'MEDIUM', file: srcDir, line: 0,
    message: 'Health check endpoints (/healthz, /readyz) may not be excluded from rate limiting.',
    fix: "Add @SkipThrottle() to HealthController class.",
  });
}

// R003: no per-token tracker
if (hasThrottler && !hasPerTokenTracker) {
  emit({
    code: 'R003', severity: 'HIGH', file: srcDir, line: 0,
    message: 'No custom getTracker() found — all requests are keyed by IP only, not by authenticated user.',
    fix: "Implement PerTokenThrottlerGuard with getTracker() returning req.user?.sub ?? req.ip. See assets/throttler.template.ts.",
  });
}

// R005: REDIS_URL not in env schema
if (hasThrottler && hasRedisStorage && !hasRedisInEnvSchema) {
  emit({
    code: 'R005', severity: 'HIGH', file: srcDir, line: 0,
    message: 'ThrottlerStorageRedisService used but REDIS_URL not found in Zod env schema.',
    fix: "Add REDIS_URL: z.string().url() to the env schema in src/config/env.schema.ts.",
  });
}

process.stderr.write(`\nAudited ${files.length} file(s). Found ${findings.length} issue(s).\n`);
if (findings.some(f => f.severity === 'CRITICAL')) process.exit(2);
if (findings.some(f => f.severity === 'HIGH')) process.exit(1);
process.exit(0);
