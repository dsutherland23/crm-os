import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { companies, branches } from './core.schema.js';
import { products, productVariants } from './products.schema.js';

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contactInfo: jsonb('contact_info').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventory = pgTable('inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  locationId: uuid('location_id').notNull().references(() => branches.id),
  quantity: integer('quantity').notNull().default(0),
  reservedQuantity: integer('reserved_quantity').notNull().default(0),
  reorderPoint: integer('reorder_point').default(0),
  reorderQty: integer('reorder_qty').default(0),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  productId: uuid('product_id').notNull(),
  variantId: uuid('variant_id'),
  locationId: uuid('location_id').notNull(),
  changeType: text('change_type').notNull(), // sale | refund | restock | transfer | adjustment | damage
  quantityDelta: integer('quantity_delta').notNull(),
  previousQuantity: integer('previous_quantity').notNull(),
  newQuantity: integer('new_quantity').notNull(),
  referenceId: uuid('reference_id'),
  referenceType: text('reference_type'),
  performedById: uuid('performed_by_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});
