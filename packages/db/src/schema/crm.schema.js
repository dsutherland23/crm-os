"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerNotes = exports.customers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
exports.customers = (0, pg_core_1.pgTable)('customers', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    // PII encrypted at application layer
    firstNameEncrypted: (0, pg_core_1.text)('first_name_encrypted').notNull(),
    lastNameEncrypted: (0, pg_core_1.text)('last_name_encrypted').notNull(),
    emailEncrypted: (0, pg_core_1.text)('email_encrypted'),
    emailHash: (0, pg_core_1.text)('email_hash'),
    phoneEncrypted: (0, pg_core_1.text)('phone_encrypted'),
    tags: (0, pg_core_1.jsonb)('tags').default([]),
    loyaltyPoints: (0, pg_core_1.integer)('loyalty_points').default(0).notNull(),
    loyaltyTier: (0, pg_core_1.text)('loyalty_tier').default('bronze').notNull(),
    clv: (0, pg_core_1.text)('clv').default('0').notNull(), // stored as string to avoid float precision
    notes: (0, pg_core_1.text)('notes'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    // GDPR: pseudonymized on erasure
    isPseudonymized: (0, pg_core_1.boolean)('is_pseudonymized').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.customerNotes = (0, pg_core_1.pgTable)('customer_notes', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    customerId: (0, pg_core_1.uuid)('customer_id').notNull().references(() => exports.customers.id, { onDelete: 'cascade' }),
    authorId: (0, pg_core_1.uuid)('author_id').notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=crm.schema.js.map