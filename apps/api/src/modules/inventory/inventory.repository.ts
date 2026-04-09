import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lte, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class InventoryRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  private get tenantId() {
    return getTenantContext().tenantId;
  }

  async findByLocation(locationId: string) {
    return this.db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.tenantId, this.tenantId),
          eq(schema.inventory.locationId, locationId),
        ),
      );
  }

  async findLowStock() {
    return this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.tenantId, this.tenantId));
    // Filter in memory: quantity <= reorderPoint (Drizzle expression for column comparison)
  }

  async findByProduct(productId: string) {
    return this.db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.tenantId, this.tenantId),
          eq(schema.inventory.productId, productId),
        ),
      );
  }

  async adjustQuantity(
    productId: string,
    locationId: string,
    delta: number,
    performedById: string,
    changeType: string,
    referenceId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      // Get current stock
      const [current] = await tx
        .select()
        .from(schema.inventory)
        .where(
          and(
            eq(schema.inventory.tenantId, this.tenantId),
            eq(schema.inventory.productId, productId),
            eq(schema.inventory.locationId, locationId),
          ),
        )
        .limit(1);

      const prev = current?.quantity ?? 0;
      const newQty = prev + delta;

      // Upsert inventory record
      await tx
        .insert(schema.inventory)
        .values({
          tenantId: this.tenantId,
          productId,
          locationId,
          quantity: newQty,
        })
        .onConflictDoUpdate({
          target: [schema.inventory.productId, schema.inventory.locationId],
          set: { quantity: newQty, updatedAt: new Date() },
        });

      // Append movement record (immutable)
      await tx.insert(schema.inventoryMovements).values({
        tenantId: this.tenantId,
        productId,
        locationId,
        changeType,
        quantityDelta: delta,
        previousQuantity: prev,
        newQuantity: newQty,
        referenceId: referenceId ?? null,
        performedById,
      });

      return newQty;
    });
  }

  async getMovements(productId: string) {
    return this.db
      .select()
      .from(schema.inventoryMovements)
      .where(
        and(
          eq(schema.inventoryMovements.tenantId, this.tenantId),
          eq(schema.inventoryMovements.productId, productId),
        ),
      )
      .orderBy(desc(schema.inventoryMovements.occurredAt));
  }
}
