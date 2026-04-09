import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  async getDashboardKpis() {
    const ctx = this.tenantId;

    const [txResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(total_cents), 0)`, count: sql<number>`COUNT(*)` })
      .from(schema.posTransactions)
      .where(
        and(
          eq(schema.posTransactions.tenantId, ctx),
          sql`completed_at >= CURRENT_DATE`,
        ),
      );

    const [customerCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.tenantId, ctx),
          eq(schema.customers.isActive, true),
        ),
      );

    return {
      todayRevenueCents: txResult?.total ?? 0,
      todayTransactions: txResult?.count ?? 0,
      totalCustomers: customerCount?.count ?? 0,
    };
  }

  async getTopProducts(limit = 10) {
    return this.db
      .select({
        productId: schema.posTransactionItems.productId,
        name: schema.posTransactionItems.name,
        totalSold: sql<number>`SUM(quantity)`,
        totalRevenueCents: sql<number>`SUM(total_cents)`,
      })
      .from(schema.posTransactionItems)
      .where(eq(schema.posTransactionItems.tenantId, this.tenantId))
      .groupBy(schema.posTransactionItems.productId, schema.posTransactionItems.name)
      .orderBy(sql`SUM(total_cents) DESC`)
      .limit(limit);
  }
}
