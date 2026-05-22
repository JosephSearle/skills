# Rate Limit Headers Reference

## IETF RateLimit Headers (Draft)

`@nestjs/throttler` supports the IETF RateLimit header draft:

| Header | Value | Meaning |
|--------|-------|---------|
| `RateLimit-Limit` | `100` | Maximum requests allowed in the current window |
| `RateLimit-Remaining` | `42` | Requests remaining before the limit is hit |
| `RateLimit-Reset` | `1717171200` | Unix timestamp when the window resets |
| `RateLimit-Policy` | `100;w=60` | Window policy: limit=100, window=60s |
| `Retry-After` | `37` | Seconds to wait (only on 429 responses) |

Older non-standard variants (`X-RateLimit-*`) are also supported and some clients expect them. `@nestjs/throttler` ≥5.x includes both unless configured otherwise.

## 429 Response Structure

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 37
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1717171237

{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Custom 429 Response Body

Override the default response by extending `ThrottlerGuard`:

```ts
@Injectable()
export class PerTokenThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    res.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${throttlerLimitDetail.timeToExpire} seconds.`,
      retryAfter: throttlerLimitDetail.timeToExpire,
    });
  }
}
```

## Client Guidance

LLM clients that call MCP servers should implement exponential back-off on 429:

```
Base delay: 1s
Max delay: 60s
Jitter: ±20%
Max retries: 5
```

When a tool call returns 429, the tool result should set `isError: true` and include the `Retry-After` value so the LLM can inform the user.
