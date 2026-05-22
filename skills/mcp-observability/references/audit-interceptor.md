# Audit Interceptor Reference

## Purpose

An audit interceptor logs every tool invocation with enough metadata to answer:
- Who called this tool? (user_sub)
- What scopes did they have? (scopes)
- Which tool was called? (tool_name)
- How long did it take? (duration_ms)
- Did it succeed or fail? (is_error)
- What were the inputs/outputs? (hashed — not logged raw)

## Log Schema

```json
{
  "event": "tool_call",
  "timestamp": "2026-05-22T10:30:00.000Z",
  "user_sub": "user123",
  "scopes": ["orders:read"],
  "tool_name": "orders_list",
  "duration_ms": 142,
  "is_error": false,
  "args_hash": "sha256:abc123def456",
  "result_hash": "sha256:789xyz"
}
```

**Never log raw args or result content** — they may contain PII, secrets, or sensitive business data.

## Hashing

Use SHA-256 of the JSON-serialised value:

```ts
import { createHash } from 'node:crypto';

function hash(value: unknown): string {
  return 'sha256:' + createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);  // 8 bytes is enough for audit correlation
}
```

The hash lets you correlate audit logs with tool output in debugging without storing the content.

## NestJS Interceptor Implementation

```ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req   = context.switchToHttp().getRequest();
    const user  = req.user as { sub?: string; scopes?: string[] } | undefined;

    return next.handle().pipe(
      tap((result) => {
        this.logger.log({
          event:       'tool_call',
          user_sub:    user?.sub,
          scopes:      user?.scopes,
          tool_name:   this.getToolName(context),
          duration_ms: Date.now() - start,
          is_error:    !!(result as any)?.isError,
          args_hash:   hash(req.body),
          result_hash: hash(result),
        });
      }),
      catchError((err) => {
        this.logger.error({
          event:       'tool_call_error',
          user_sub:    user?.sub,
          tool_name:   this.getToolName(context),
          duration_ms: Date.now() - start,
          is_error:    true,
          error_code:  (err as any)?.code,
        });
        throw err;
      }),
    );
  }

  private getToolName(context: ExecutionContext): string {
    return Reflect.getMetadata('tool:name', context.getHandler()) ?? 'unknown';
  }
}
```

## Registration

```ts
// AppModule.providers
{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }
```

This registers the interceptor globally — it runs on every HTTP request, including non-MCP endpoints. If you want tool-only auditing, apply the interceptor selectively using `@UseInterceptors(AuditInterceptor)` on the MCP controller.
