import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class PricingRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  findRules() {
    return this.db
      .select()
      .from(schema.priceRules)
      .where(eq(schema.priceRules.tenantId, this.tenantId));
  }

  createRule(data: typeof schema.priceRules.$inferInsert) {
    return this.db
      .insert(schema.priceRules)
      .values({ ...data, tenantId: this.tenantId })
      .returning();
  }
}
