import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { tenantStorage } from './tenant.context.js';

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      tenantId: string;
      sub: string;
      role: string;
      branchId?: string;
    };
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    const user = req.user;

    if (!user?.tenantId) {
      // Try to parse JWT from Authorization header manually
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const parts = token.split('.');
          if (parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as {
              tenantId?: string;
              sub?: string;
              role?: string;
              branchId?: string;
            };
            if (payload.tenantId) {
              const ctx: import('./tenant.context.js').TenantContext = {
                tenantId: payload.tenantId,
                userId: payload.sub ?? 'unknown',
                userRole: payload.role ?? 'staff',
              };
              if (payload.branchId) ctx.branchId = payload.branchId;
              
              tenantStorage.run(ctx, next);
              return;
            }
          }
        } catch {
          // Invalid token, continue without context
        }
      }
      next();
      return;
    }

    const ctx: import('./tenant.context.js').TenantContext = {
      tenantId: user.tenantId,
      userId: user.sub,
      userRole: user.role,
    };
    if (user.branchId) ctx.branchId = user.branchId;

    tenantStorage.run(ctx, next);
  }
}
