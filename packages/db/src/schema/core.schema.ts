import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'manager',
  'staff',
  'accountant',
]);

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  supabaseUserId: uuid('supabase_user_id').notNull().unique(),
  role: userRoleEnum('role').notNull().default('staff'),
  branchId: uuid('branch_id').references(() => branches.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  // PII encrypted at application layer
  emailEncrypted: text('email_encrypted').notNull(),
  emailHash: text('email_hash').notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  moduleId: text('module_id').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  enabledForRoles: jsonb('enabled_for_roles').default([]),
  enabledForUsers: jsonb('enabled_for_users').default([]),
  metadata: jsonb('metadata').default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  idempotencyKey: uuid('idempotency_key').notNull().unique(),
  status: text('status').notNull().default('pending'), // pending | delivered | failed
  attempts: text('attempts').notNull().default('0'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
