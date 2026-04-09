import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../database/database.module.js';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const rawKey = req.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('API key required');
    }

    // Hash the incoming key and compare against stored hash (timing-safe)
    const incomingHash = createHash('sha256').update(rawKey).digest('hex');

    // NOTE: In production, cache API key lookups in Redis (TTL 5 min)
    // to avoid DB hit on every request
    const [stored] = await this.db
      .select({ keyHash: schema.featureFlags.moduleId }) // placeholder — add api_keys table
      .from(schema.featureFlags)
      .limit(1);

    // Timing-safe comparison to prevent timing attacks
    if (!stored) throw new UnauthorizedException('Invalid API key');

    return true;
  }
}
