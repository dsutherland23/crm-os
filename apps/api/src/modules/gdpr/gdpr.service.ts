import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class GdprService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * GDPR Article 15 — Right of Access
   * Exports all data associated with a customer.
   */
  async exportCustomerData(customerId: string): Promise<Record<string, unknown>> {
    const ctx = getTenantContext();

    const [customer] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);

    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const notes = await this.db
      .select()
      .from(schema.customerNotes)
      .where(
        and(
          eq(schema.customerNotes.customerId, customerId),
          eq(schema.customerNotes.tenantId, ctx.tenantId),
        ),
      );

    const transactions = await this.db
      .select()
      .from(schema.posTransactions)
      .where(
        and(
          eq(schema.posTransactions.customerId, customerId),
          eq(schema.posTransactions.tenantId, ctx.tenantId),
        ),
      );

    const invoices = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.customerId, customerId),
          eq(schema.invoices.tenantId, ctx.tenantId),
        ),
      );

    return {
      exportedAt: new Date().toISOString(),
      gdprRequest: 'Article 15 — Right of Access',
      customer,
      notes,
      transactions,
      invoices,
    };
  }

  /**
   * GDPR Article 17 — Right to Erasure ("Right to be Forgotten")
   * Pseudonymizes PII. Preserves records for accounting/legal purposes.
   */
  async eraseCustomerData(customerId: string): Promise<{ message: string }> {
    const ctx = getTenantContext();

    const [customer] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.tenantId, ctx.tenantId),
        ),
      )
      .limit(1);

    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(customerId).digest('hex').slice(0, 8);

    await this.db
      .update(schema.customers)
      .set({
        firstNameEncrypted: `DELETED_${hash}`,
        lastNameEncrypted: `DELETED_${hash}`,
        emailEncrypted: null,
        emailHash: null,
        phoneEncrypted: null,
        isPseudonymized: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.tenantId, ctx.tenantId),
        ),
      );

    // Pseudonymize notes as well
    await this.db
      .update(schema.customerNotes)
      .set({ content: '[CONTENT ERASED PER GDPR REQUEST]' })
      .where(
        and(
          eq(schema.customerNotes.customerId, customerId),
          eq(schema.customerNotes.tenantId, ctx.tenantId),
        ),
      );

    return {
      message: `Customer data pseudonymized per GDPR Article 17 erasure request. Financial records preserved for legal compliance.`,
    };
  }
}
