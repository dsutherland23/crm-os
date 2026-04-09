import { pgTable, uuid, text, timestamp, boolean, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './core.schema.js';
import { customers } from './crm.schema.js';

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(), // asset | liability | equity | revenue | expense | tax
  parentId: uuid('parent_id'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  entryNumber: text('entry_number').notNull(),
  description: text('description').notNull(),
  referenceType: text('reference_type'), // sale | refund | invoice | payment | adjustment
  referenceId: uuid('reference_id'),
  reversalOfId: uuid('reversal_of_id'),
  postedById: uuid('posted_by_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Journal lines are immutable — enforced by DB trigger + RLS
export const journalLines = pgTable('journal_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  // Stored as integers (cents) to avoid floating-point issues
  debitCents: integer('debit_cents').notNull().default(0),
  creditCents: integer('credit_cents').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  status: text('status').notNull().default('draft'), // draft | sent | paid | overdue | cancelled
  subtotalCents: integer('subtotal_cents').notNull(),
  taxCents: integer('tax_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull().default('EUR'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  customerId: uuid('customer_id').references(() => customers.id),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('EUR'),
  method: text('method').notNull(), // stripe | cash | bank_transfer
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: text('status').notNull().default('pending'), // pending | completed | failed | refunded
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
