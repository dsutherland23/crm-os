"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posTransactionItems = exports.posTransactions = exports.posSessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
const crm_schema_js_1 = require("./crm.schema.js");
exports.posSessions = (0, pg_core_1.pgTable)('pos_sessions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    branchId: (0, pg_core_1.uuid)('branch_id').notNull().references(() => core_schema_js_1.branches.id),
    cashierId: (0, pg_core_1.uuid)('cashier_id').notNull().references(() => core_schema_js_1.users.id),
    status: (0, pg_core_1.text)('status').notNull().default('open'), // open | closed
    openedAt: (0, pg_core_1.timestamp)('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: (0, pg_core_1.timestamp)('closed_at', { withTimezone: true }),
    openingCashCents: (0, pg_core_1.integer)('opening_cash_cents').notNull().default(0),
    closingCashCents: (0, pg_core_1.integer)('closing_cash_cents'),
});
exports.posTransactions = (0, pg_core_1.pgTable)('pos_transactions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    // Client-generated UUIDv7 for offline idempotency
    offlineId: (0, pg_core_1.uuid)('offline_id').notNull().unique(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    posSessionId: (0, pg_core_1.uuid)('pos_session_id').notNull().references(() => exports.posSessions.id),
    customerId: (0, pg_core_1.uuid)('customer_id').references(() => crm_schema_js_1.customers.id),
    status: (0, pg_core_1.text)('status').notNull().default('completed'), // completed | refunded | void
    subtotalCents: (0, pg_core_1.integer)('subtotal_cents').notNull(),
    taxCents: (0, pg_core_1.integer)('tax_cents').notNull().default(0),
    discountCents: (0, pg_core_1.integer)('discount_cents').notNull().default(0),
    totalCents: (0, pg_core_1.integer)('total_cents').notNull(),
    payments: (0, pg_core_1.jsonb)('payments').notNull().default([]),
    receiptSent: (0, pg_core_1.boolean)('receipt_sent').default(false).notNull(),
    syncedFromOffline: (0, pg_core_1.boolean)('synced_from_offline').default(false).notNull(),
    completedAt: (0, pg_core_1.timestamp)('completed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.posTransactionItems = (0, pg_core_1.pgTable)('pos_transaction_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').notNull().references(() => exports.posTransactions.id),
    productId: (0, pg_core_1.uuid)('product_id').notNull(),
    variantId: (0, pg_core_1.uuid)('variant_id'),
    name: (0, pg_core_1.text)('name').notNull(), // snapshot at time of sale
    sku: (0, pg_core_1.text)('sku'),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitPriceCents: (0, pg_core_1.integer)('unit_price_cents').notNull(),
    discountCents: (0, pg_core_1.integer)('discount_cents').notNull().default(0),
    totalCents: (0, pg_core_1.integer)('total_cents').notNull(),
});
//# sourceMappingURL=pos.schema.js.map