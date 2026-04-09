import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class FinanceRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  async findInvoices(status?: string) {
    const base = this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.tenantId, this.tenantId))
      .orderBy(desc(schema.invoices.createdAt));
    return base;
  }

  async findInvoiceById(id: string) {
    const [invoice] = await this.db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.id, id), eq(schema.invoices.tenantId, this.tenantId)))
      .limit(1);
    return invoice ?? null;
  }

  async createInvoice(data: typeof schema.invoices.$inferInsert) {
    const [created] = await this.db
      .insert(schema.invoices)
      .values({ ...data, tenantId: this.tenantId })
      .returning();
    return created!;
  }

  async markInvoicePaid(id: string, paidAt: Date) {
    const [updated] = await this.db
      .update(schema.invoices)
      .set({ status: 'paid', paidAt, updatedAt: new Date() })
      .where(and(eq(schema.invoices.id, id), eq(schema.invoices.tenantId, this.tenantId)))
      .returning();
    return updated ?? null;
  }

  async findJournalEntries() {
    return this.db
      .select()
      .from(schema.journalEntries)
      .where(eq(schema.journalEntries.tenantId, this.tenantId))
      .orderBy(desc(schema.journalEntries.occurredAt));
  }

  async getChartOfAccounts() {
    return this.db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.tenantId, this.tenantId));
  }
}
