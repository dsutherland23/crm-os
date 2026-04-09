import { Injectable, Inject } from '@nestjs/common';
import { eq, and, like, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class ProductsRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  async findAll(search?: string) {
    const conditions = [eq(schema.products.tenantId, this.tenantId)];
    if (search) conditions.push(like(schema.products.name, `%${search}%`));
    return this.db
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(desc(schema.products.createdAt));
  }

  async findById(id: string) {
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, this.tenantId)))
      .limit(1);
    return product ?? null;
  }

  async create(data: typeof schema.products.$inferInsert) {
    const [created] = await this.db
      .insert(schema.products)
      .values({ ...data, tenantId: this.tenantId })
      .returning();
    return created!;
  }

  async update(id: string, data: Partial<typeof schema.products.$inferInsert>) {
    const [updated] = await this.db
      .update(schema.products)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, this.tenantId)))
      .returning();
    return updated ?? null;
  }

  async softDelete(id: string) {
    return this.update(id, { isActive: false });
  }

  async findVariants(productId: string) {
    return this.db
      .select()
      .from(schema.productVariants)
      .where(
        and(
          eq(schema.productVariants.productId, productId),
          eq(schema.productVariants.tenantId, this.tenantId),
        ),
      );
  }

  async createVariant(data: typeof schema.productVariants.$inferInsert) {
    const [created] = await this.db
      .insert(schema.productVariants)
      .values({ ...data, tenantId: this.tenantId })
      .returning();
    return created!;
  }
}
