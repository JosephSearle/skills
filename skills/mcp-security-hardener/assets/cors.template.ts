// Targets: @nestjs/core ^10.x
// Copy the enableCors call into main.ts after NestFactory.create.
// Set CORS_ALLOWED_ORIGINS in your environment: comma-separated list of allowed origins.

import { INestApplication } from '@nestjs/common';

export function configureCors(app: INestApplication): void {
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    // Dynamic origin check — never '*' on an authenticated MCP server
    origin: (origin, callback) => {
      // Requests with no Origin header (server-to-server, CLI tools) are allowed
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not in the allowlist`));
      }
    },

    // Methods needed for Streamable HTTP transport
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],

    // Headers the client is allowed to send
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Mcp-Session-Id',    // required for stateful mode
      'Last-Event-ID',     // required for SSE reconnection
    ],

    // Headers the browser is allowed to read from the response
    // Mcp-Session-Id MUST be exposed so the client can save it
    exposedHeaders: ['Mcp-Session-Id'],

    // Allow cookies / Authorization headers cross-origin
    credentials: true,

    // Preflight cache duration (seconds)
    maxAge: 86400,
  });
  // NestJS sets Vary: Origin automatically when using a function origin
}
