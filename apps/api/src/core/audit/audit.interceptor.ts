import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from '../database/database.module.js';
import { getTenantContext } from '../tenant/tenant.context.js';
import * as schema from '@crm-os/db';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { FastifyRequest } from 'fastify';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    if (!MUTATING_METHODS.has(req.method)) {
      return next.handle();
    }

    const startAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          try {
            const ctx = getTenantContext();
            void this.db.insert(schema.auditLogs).values({
              tenantId: ctx.tenantId,
              actorId: ctx.userId,
              actorRole: ctx.userRole,
              action: `${req.method} ${req.url}`,
              entityType: req.url.split('/')[3] ?? 'unknown',
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'] ?? null,
              after: req.body as Record<string, unknown>,
            });
          } catch {
            this.logger.warn('Audit log skipped — no tenant context (public route)');
          }
        },
      }),
    );
  }
}
