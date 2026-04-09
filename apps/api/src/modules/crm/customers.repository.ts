import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { createHash } from 'crypto';

@Injectable()
export class CustomersRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  /** Hash email for lookup without decrypting */
  private hashEmail(email: string): string {
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  }

  async findAll() {
    return this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.tenantId, this.tenantId),
          eq(schema.customers.isActive, true),
          eq(schema.customers.isPseudonymized, false),
        ),
      )
      .orderBy(desc(schema.customers.createdAt));
  }

  async findById(id: string) {
    const [customer] = await this.db
      .select()
      .from(schema.customers)
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, this.tenantId)))
      .limit(1);
    return customer ?? null;
  }

  async create(data: {
    firstNameEncrypted: string;
    lastNameEncrypted: string;
    emailEncrypted?: string;
    email?: string;
    phoneEncrypted?: string;
    tags?: unknown[];
  }) {
    const [created] = await this.db
      .insert(schema.customers)
      .values({
        tenantId: this.tenantId,
        firstNameEncrypted: data.firstNameEncrypted,
        lastNameEncrypted: data.lastNameEncrypted,
        emailEncrypted: data.emailEncrypted ?? null,
        emailHash: data.email ? this.hashEmail(data.email) : null,
        phoneEncrypted: data.phoneEncrypted ?? null,
        tags: data.tags ?? [],
      })
      .returning();
    return created!;
  }

  async update(id: string, data: Partial<typeof schema.customers.$inferInsert>) {
    const [updated] = await this.db
      .update(schema.customers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, this.tenantId)))
      .returning();
    return updated ?? null;
  }

  /** GDPR erasure: pseudonymize PII, preserve record for ledger integrity */
  async pseudonymize(id: string) {
    const hash = createHash('sha256').update(id).digest('hex').slice(0, 8);
    return this.db
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
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, this.tenantId)));
  }

  async addLoyaltyPoints(id: string, points: number) {
    const customer = await this.findById(id);
    if (!customer) return null;
    const newPoints = (customer.loyaltyPoints ?? 0) + points;
    return this.update(id, { loyaltyPoints: newPoints });
  }
}
