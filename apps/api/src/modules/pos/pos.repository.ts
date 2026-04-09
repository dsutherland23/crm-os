import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class PosRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  async openSession(cashierId: string, branchId: string, openingCashCents: number) {
    const [session] = await this.db
      .insert(schema.posSessions)
      .values({ tenantId: this.tenantId, cashierId, branchId, openingCashCents })
      .returning();
    return session!;
  }

  async closeSession(sessionId: string, closingCashCents: number) {
    const [session] = await this.db
      .update(schema.posSessions)
      .set({ status: 'closed', closedAt: new Date(), closingCashCents })
      .where(and(eq(schema.posSessions.id, sessionId), eq(schema.posSessions.tenantId, this.tenantId)))
      .returning();
    return session ?? null;
  }

  async createTransaction(data: typeof schema.posTransactions.$inferInsert) {
    // Idempotent: ON CONFLICT (offline_id) DO NOTHING
    const [tx] = await this.db
      .insert(schema.posTransactions)
      .values({ ...data, tenantId: this.tenantId })
      .onConflictDoNothing({ target: schema.posTransactions.offlineId })
      .returning();
    return tx ?? null; // null = duplicate offline_id (safe to ignore)
  }

  async createTransactionItems(items: typeof schema.posTransactionItems.$inferInsert[]) {
    return this.db.insert(schema.posTransactionItems).values(items).returning();
  }

  async getSessionTransactions(sessionId: string) {
    return this.db
      .select()
      .from(schema.posTransactions)
      .where(
        and(
          eq(schema.posTransactions.posSessionId, sessionId),
          eq(schema.posTransactions.tenantId, this.tenantId),
        ),
      )
      .orderBy(desc(schema.posTransactions.completedAt));
  }
}
