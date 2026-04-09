"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payments = exports.invoices = exports.journalLines = exports.journalEntries = exports.chartOfAccounts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
const crm_schema_js_1 = require("./crm.schema.js");
exports.chartOfAccounts = (0, pg_core_1.pgTable)('chart_of_accounts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    code: (0, pg_core_1.text)('code').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    accountType: (0, pg_core_1.text)('account_type').notNull(), // asset | liability | equity | revenue | expense | tax
    parentId: (0, pg_core_1.uuid)('parent_id'),
    isSystem: (0, pg_core_1.boolean)('is_system').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.journalEntries = (0, pg_core_1.pgTable)('journal_entries', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    entryNumber: (0, pg_core_1.text)('entry_number').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    referenceType: (0, pg_core_1.text)('reference_type'), // sale | refund | invoice | payment | adjustment
    referenceId: (0, pg_core_1.uuid)('reference_id'),
    reversalOfId: (0, pg_core_1.uuid)('reversal_of_id'),
    postedById: (0, pg_core_1.uuid)('posted_by_id').notNull(),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Journal lines are immutable — enforced by DB trigger + RLS
exports.journalLines = (0, pg_core_1.pgTable)('journal_lines', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    journalEntryId: (0, pg_core_1.uuid)('journal_entry_id').notNull().references(() => exports.journalEntries.id),
    accountId: (0, pg_core_1.uuid)('account_id').notNull().references(() => exports.chartOfAccounts.id),
    // Stored as integers (cents) to avoid floating-point issues
    debitCents: (0, pg_core_1.integer)('debit_cents').notNull().default(0),
    creditCents: (0, pg_core_1.integer)('credit_cents').notNull().default(0),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.invoices = (0, pg_core_1.pgTable)('invoices', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    invoiceNumber: (0, pg_core_1.text)('invoice_number').notNull(),
    customerId: (0, pg_core_1.uuid)('customer_id').references(() => crm_schema_js_1.customers.id),
    status: (0, pg_core_1.text)('status').notNull().default('draft'), // draft | sent | paid | overdue | cancelled
    subtotalCents: (0, pg_core_1.integer)('subtotal_cents').notNull(),
    taxCents: (0, pg_core_1.integer)('tax_cents').notNull().default(0),
    discountCents: (0, pg_core_1.integer)('discount_cents').notNull().default(0),
    totalCents: (0, pg_core_1.integer)('total_cents').notNull(),
    currency: (0, pg_core_1.text)('currency').notNull().default('EUR'),
    dueAt: (0, pg_core_1.timestamp)('due_at', { withTimezone: true }),
    paidAt: (0, pg_core_1.timestamp)('paid_at', { withTimezone: true }),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    invoiceId: (0, pg_core_1.uuid)('invoice_id').references(() => exports.invoices.id),
    customerId: (0, pg_core_1.uuid)('customer_id').references(() => crm_schema_js_1.customers.id),
    amountCents: (0, pg_core_1.integer)('amount_cents').notNull(),
    currency: (0, pg_core_1.text)('currency').notNull().default('EUR'),
    method: (0, pg_core_1.text)('method').notNull(), // stripe | cash | bank_transfer
    stripePaymentIntentId: (0, pg_core_1.text)('stripe_payment_intent_id'),
    status: (0, pg_core_1.text)('status').notNull().default('pending'), // pending | completed | failed | refunded
    capturedAt: (0, pg_core_1.timestamp)('captured_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=finance.schema.js.map