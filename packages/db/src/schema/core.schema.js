"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventOutbox = exports.auditLogs = exports.featureFlags = exports.users = exports.branches = exports.companies = exports.userRoleEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.userRoleEnum = (0, pg_core_1.pgEnum)('user_role', [
    'super_admin',
    'admin',
    'manager',
    'staff',
    'accountant',
]);
exports.companies = (0, pg_core_1.pgTable)('companies', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    slug: (0, pg_core_1.text)('slug').notNull().unique(),
    logoUrl: (0, pg_core_1.text)('logo_url'),
    settings: (0, pg_core_1.jsonb)('settings').default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.branches = (0, pg_core_1.pgTable)('branches', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => exports.companies.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    address: (0, pg_core_1.text)('address'),
    isDefault: (0, pg_core_1.boolean)('is_default').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => exports.companies.id, { onDelete: 'cascade' }),
    supabaseUserId: (0, pg_core_1.uuid)('supabase_user_id').notNull().unique(),
    role: (0, exports.userRoleEnum)('role').notNull().default('staff'),
    branchId: (0, pg_core_1.uuid)('branch_id').references(() => exports.branches.id),
    firstName: (0, pg_core_1.text)('first_name').notNull(),
    lastName: (0, pg_core_1.text)('last_name').notNull(),
    // PII encrypted at application layer
    emailEncrypted: (0, pg_core_1.text)('email_encrypted').notNull(),
    emailHash: (0, pg_core_1.text)('email_hash').notNull().unique(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.featureFlags = (0, pg_core_1.pgTable)('feature_flags', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => exports.companies.id, { onDelete: 'cascade' }),
    moduleId: (0, pg_core_1.text)('module_id').notNull(),
    enabled: (0, pg_core_1.boolean)('enabled').notNull().default(false),
    enabledForRoles: (0, pg_core_1.jsonb)('enabled_for_roles').default([]),
    enabledForUsers: (0, pg_core_1.jsonb)('enabled_for_users').default([]),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    actorId: (0, pg_core_1.uuid)('actor_id').notNull(),
    actorRole: (0, pg_core_1.text)('actor_role').notNull(),
    action: (0, pg_core_1.text)('action').notNull(),
    entityType: (0, pg_core_1.text)('entity_type').notNull(),
    entityId: (0, pg_core_1.uuid)('entity_id'),
    before: (0, pg_core_1.jsonb)('before'),
    after: (0, pg_core_1.jsonb)('after'),
    ipAddress: (0, pg_core_1.text)('ip_address'),
    userAgent: (0, pg_core_1.text)('user_agent'),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.eventOutbox = (0, pg_core_1.pgTable)('event_outbox', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
    idempotencyKey: (0, pg_core_1.uuid)('idempotency_key').notNull().unique(),
    status: (0, pg_core_1.text)('status').notNull().default('pending'), // pending | delivered | failed
    attempts: (0, pg_core_1.text)('attempts').notNull().default('0'),
    lastAttemptAt: (0, pg_core_1.timestamp)('last_attempt_at', { withTimezone: true }),
    deliveredAt: (0, pg_core_1.timestamp)('delivered_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=core.schema.js.map