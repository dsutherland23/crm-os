import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { companies } from './core.schema.js';

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // PII encrypted at application layer
  firstNameEncrypted: text('first_name_encrypted').notNull(),
  lastNameEncrypted: text('last_name_encrypted').notNull(),
  emailEncrypted: text('email_encrypted'),
  emailHash: text('email_hash'),
  phoneEncrypted: text('phone_encrypted'),
  tags: jsonb('tags').default([]),
  loyaltyPoints: integer('loyalty_points').default(0).notNull(),
  loyaltyTier: text('loyalty_tier').default('bronze').notNull(),
  clv: text('clv').default('0').notNull(), // stored as string to avoid float precision
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  // GDPR: pseudonymized on erasure
  isPseudonymized: boolean('is_pseudonymized').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customerNotes = pgTable('customer_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
