"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productVariants = exports.products = exports.categories = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    parentId: (0, pg_core_1.uuid)('parent_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    categoryId: (0, pg_core_1.uuid)('category_id').references(() => exports.categories.id),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    sku: (0, pg_core_1.text)('sku'),
    barcode: (0, pg_core_1.text)('barcode'),
    qrCode: (0, pg_core_1.text)('qr_code'),
    imageUrl: (0, pg_core_1.text)('image_url'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.productVariants = (0, pg_core_1.pgTable)('product_variants', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    sku: (0, pg_core_1.text)('sku'),
    barcode: (0, pg_core_1.text)('barcode'),
    attributes: (0, pg_core_1.jsonb)('attributes').default({}), // { color: 'red', size: 'XL' }
    imageUrl: (0, pg_core_1.text)('image_url'),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0).notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=products.schema.js.map