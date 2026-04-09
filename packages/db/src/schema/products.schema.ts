import { pgTable, uuid, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';
import { companies } from './core.schema.js';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  sku: text('sku'),
  barcode: text('barcode'),
  qrCode: text('qr_code'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  attributes: jsonb('attributes').default({}), // { color: 'red', size: 'XL' }
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
