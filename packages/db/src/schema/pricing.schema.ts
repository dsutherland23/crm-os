import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { companies } from './core.schema.js';
import { customers } from './crm.schema.js';
import { products, productVariants } from './products.schema.js';

export const priceRules = pgTable('price_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(), // default | wholesale | retail | tier | promo | customer
  productId: uuid('product_id').references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  priceCents: integer('price_cents').notNull(),
  discountPercent: integer('discount_percent').default(0),
  minQuantity: integer('min_quantity').default(1).notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customerPriceOverrides = pgTable('customer_price_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  priceCents: integer('price_cents').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
