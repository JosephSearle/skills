// Targets: @nestjs/common ^10.x, rxjs ^7.x
// Copy to: src/mcp/interceptors/audit.interceptor.ts
// Register in AppModule.providers: { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { createHash } from 'node:crypto';

function hashValue(value: unknown): string {
  return 'sha256:' + createHash('sha256')
    .update(JSON.stringify(value) ?? '')
    .digest('hex')
    .slice(0, 16);
}

interface RequestUser {
  sub?: string;
  scopes?: string[];
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only audit HTTP context (MCP uses HTTP)
    if (context.getType() !== 'http') return next.handle();

    const start = Date.now();
    const req   = context.switchToHttp().getRequest<{ user?: RequestUser; body?: unknown }>();
    const user  = req.user;

    return next.handle().pipe(
      tap((result: unknown) => {
        const isError = !!(result as Record<string, unknown>)?.isError;

        this.logger.log({
          event:       'tool_call',
          user_sub:    user?.sub,
          scopes:      user?.scopes,
          tool_name:   this.resolveToolName(context),
          duration_ms: Date.now() - start,
          is_error:    isError,
          // Hash inputs and outputs — never log raw values (may contain PII/secrets)
          args_hash:   hashValue(req.body),
          result_hash: hashValue(result),
        });
      }),
      catchError((err: unknown) => {
        this.logger.error({
          event:       'tool_call_error',
          user_sub:    user?.sub,
          tool_name:   this.resolveToolName(context),
          duration_ms: Date.now() - start,
          is_error:    true,
          error_code:  (err as Record<string, unknown>)?.code,
        });
        throw err;
      }),
    );
  }

  private resolveToolName(context: ExecutionContext): string {
    const handler = context.getHandler();
    return (
      Reflect.getMetadata('tool:name', handler) ??
      handler.name ??
      'unknown'
    );
  }
}
