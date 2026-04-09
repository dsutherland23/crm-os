"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerPriceOverrides = exports.priceRules = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
const crm_schema_js_1 = require("./crm.schema.js");
const products_schema_js_1 = require("./products.schema.js");
exports.priceRules = (0, pg_core_1.pgTable)('price_rules', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    ruleType: (0, pg_core_1.text)('rule_type').notNull(), // default | wholesale | retail | tier | promo | customer
    productId: (0, pg_core_1.uuid)('product_id').references(() => products_schema_js_1.products.id),
    variantId: (0, pg_core_1.uuid)('variant_id').references(() => products_schema_js_1.productVariants.id),
    priceCents: (0, pg_core_1.integer)('price_cents').notNull(),
    discountPercent: (0, pg_core_1.integer)('discount_percent').default(0),
    minQuantity: (0, pg_core_1.integer)('min_quantity').default(1).notNull(),
    validFrom: (0, pg_core_1.timestamp)('valid_from', { withTimezone: true }),
    validTo: (0, pg_core_1.timestamp)('valid_to', { withTimezone: true }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.customerPriceOverrides = (0, pg_core_1.pgTable)('customer_price_overrides', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    customerId: (0, pg_core_1.uuid)('customer_id').notNull().references(() => crm_schema_js_1.customers.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => products_schema_js_1.products.id),
    variantId: (0, pg_core_1.uuid)('variant_id').references(() => products_schema_js_1.productVariants.id),
    priceCents: (0, pg_core_1.integer)('price_cents').notNull(),
    validFrom: (0, pg_core_1.timestamp)('valid_from', { withTimezone: true }),
    validTo: (0, pg_core_1.timestamp)('valid_to', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=pricing.schema.js.map