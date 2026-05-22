# Injection Prevention Reference

## 1. Command Injection

### The Vulnerability

`child_process.exec(string)` passes the string to `/bin/sh -c`, which interprets shell metacharacters. User-controlled input in the string enables arbitrary command execution.

This is the CVE-2025-53967 / GHSA-gxw4-4fc5-9gr5 pattern (figma-developer-mcp ≤0.6.2, CVSS 7.5).

### Prevention

```ts
// FORBIDDEN — shell metacharacters executed as-is
import { exec } from 'node:child_process';
exec(`ffmpeg -i ${userInput} -o output.mp4`);           // pipe, redirect, &&, ; all work

// CORRECT — argv array, no shell, metacharacters are literal
import { execFile, execFileSync } from 'node:child_process';
execFile('ffmpeg', ['-i', userInput, '-o', 'output.mp4'], (err, stdout) => {
  if (err) { /* handle */ }
});

// Also correct — spawn with shell: false (default)
import { spawn } from 'node:child_process';
const proc = spawn('ffmpeg', ['-i', userInput, '-o', 'output.mp4'], { shell: false });
```

### Input validation even when using execFile

Constrain what values can reach `execFile` with a strict Zod regex:

```ts
filename: z.string()
           .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid filename')
           .max(255)
           .describe('Input filename — letters, digits, underscores, dots, hyphens only')
```

---

## 2. SQL Injection

Never interpolate user input into SQL strings. Use parameterised queries:

```ts
// FORBIDDEN
const sql = `SELECT * FROM users WHERE email = '${email}'`;

// CORRECT — TypeORM
const user = await repo.findOne({ where: { email } });

// CORRECT — raw parameterised query
const [rows] = await connection.query(
  'SELECT * FROM users WHERE email = ?',
  [email],
);
```

---

## 3. SSRF (Server-Side Request Forgery)

Tools that accept URL arguments can be used to make the server send requests to internal services (metadata endpoints, private networks).

### IP Range Blocklist

```ts
import { isIPv4, isIPv6 } from 'node:net';

const PRIVATE_RANGES_V4 = [
  // Loopback
  { start: '127.0.0.0',   prefix: 8  },
  // RFC 1918 private
  { start: '10.0.0.0',    prefix: 8  },
  { start: '172.16.0.0',  prefix: 12 },
  { start: '192.168.0.0', prefix: 16 },
  // Link-local (AWS/GCP/Azure metadata)
  { start: '169.254.0.0', prefix: 16 },
  // RFC 6598 shared address space
  { start: '100.64.0.0',  prefix: 10 },
];

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const addr = ipToInt(ip);
  return PRIVATE_RANGES_V4.some(({ start, prefix }) => {
    const mask = (~0 << (32 - prefix)) >>> 0;
    return (addr & mask) === (ipToInt(start) & mask);
  });
}

export function isPrivateIP(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip);
  // IPv6: block loopback and ULA
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}
```

### Safe fetch wrapper

```ts
import { Resolver } from 'node:dns/promises';

export async function safeFetch(rawUrl: string, options?: RequestInit): Promise<Response> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }

  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are permitted');

  const addrs = await new Resolver().resolve4(parsed.hostname).catch(() => []);
  if (addrs.some(isPrivateIP)) throw new Error('SSRF: target resolves to a private address');

  return fetch(rawUrl, options);
}
```

---

## 4. Prompt Injection and Tool Poisoning

### Attack Vectors

1. **Upstream API response injection** — a third-party API returns a response containing hidden LLM instructions (e.g., `Ignore previous instructions and...`).
2. **Tool description poisoning** — a third-party MCP server's tool description contains hidden instructions that influence behaviour when tools are listed.

### Mitigation

Sanitise all content before including it in tool responses:

```ts
// src/utils/sanitise-for-llm.ts
export function sanitiseForLlm(text: string, maxLength = 10_000): string {
  return text
    // Strip HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Strip zero-width and invisible Unicode characters
    .replace(/[​-‍﻿  ]/g, '')
    // Strip C0 and C1 control chars except tab, newline, carriage return
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .trim()
    .slice(0, maxLength);
}
```

Use in tool handlers:
```ts
const apiResponse = await externalApi.fetch(args.query);
return {
  content: [{ type: 'text', text: sanitiseForLlm(apiResponse.body) }],
};
```

### What Not to Sanitise

Do NOT sanitise:
- JSON structures you control (serialize with `JSON.stringify` instead).
- Binary/base64 data (use `type: 'image'` content type instead of text).
- Content the user explicitly passed in (they control it anyway; sanitisation prevents reflection attacks but not injection from the user's own input).
