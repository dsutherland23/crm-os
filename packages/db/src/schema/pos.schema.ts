import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { companies, branches, users } from './core.schema.js';
import { customers } from './crm.schema.js';

export const posSessions = pgTable('pos_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  cashierId: uuid('cashier_id').notNull().references(() => users.id),
  status: text('status').notNull().default('open'), // open | closed
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  openingCashCents: integer('opening_cash_cents').notNull().default(0),
  closingCashCents: integer('closing_cash_cents'),
});

export const posTransactions = pgTable('pos_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Client-generated UUIDv7 for offline idempotency
  offlineId: uuid('offline_id').notNull().unique(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  posSessionId: uuid('pos_session_id').notNull().references(() => posSessions.id),
  customerId: uuid('customer_id').references(() => customers.id),
  status: text('status').notNull().default('completed'), // completed | refunded | void
  subtotalCents: integer('subtotal_cents').notNull(),
  taxCents: integer('tax_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  payments: jsonb('payments').notNull().default([]),
  receiptSent: boolean('receipt_sent').default(false).notNull(),
  syncedFromOffline: boolean('synced_from_offline').default(false).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const posTransactionItems = pgTable('pos_transaction_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  transactionId: uuid('transaction_id').notNull().references(() => posTransactions.id),
  productId: uuid('product_id').notNull(),
  variantId: uuid('variant_id'),
  name: text('name').notNull(), // snapshot at time of sale
  sku: text('sku'),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
});
