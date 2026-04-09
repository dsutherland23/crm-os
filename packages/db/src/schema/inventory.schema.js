"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryMovements = exports.inventory = exports.suppliers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const core_schema_js_1 = require("./core.schema.js");
const products_schema_js_1 = require("./products.schema.js");
exports.suppliers = (0, pg_core_1.pgTable)('suppliers', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    contactInfo: (0, pg_core_1.jsonb)('contact_info').default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.inventory = (0, pg_core_1.pgTable)('inventory', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull().references(() => core_schema_js_1.companies.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => products_schema_js_1.products.id),
    variantId: (0, pg_core_1.uuid)('variant_id').references(() => products_schema_js_1.productVariants.id),
    locationId: (0, pg_core_1.uuid)('location_id').notNull().references(() => core_schema_js_1.branches.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(0),
    reservedQuantity: (0, pg_core_1.integer)('reserved_quantity').notNull().default(0),
    reorderPoint: (0, pg_core_1.integer)('reorder_point').default(0),
    reorderQty: (0, pg_core_1.integer)('reorder_qty').default(0),
    supplierId: (0, pg_core_1.uuid)('supplier_id').references(() => exports.suppliers.id),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.inventoryMovements = (0, pg_core_1.pgTable)('inventory_movements', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    tenantId: (0, pg_core_1.uuid)('tenant_id').notNull(),
    productId: (0, pg_core_1.uuid)('product_id').notNull(),
    variantId: (0, pg_core_1.uuid)('variant_id'),
    locationId: (0, pg_core_1.uuid)('location_id').notNull(),
    changeType: (0, pg_core_1.text)('change_type').notNull(), // sale | refund | restock | transfer | adjustment | damage
    quantityDelta: (0, pg_core_1.integer)('quantity_delta').notNull(),
    previousQuantity: (0, pg_core_1.integer)('previous_quantity').notNull(),
    newQuantity: (0, pg_core_1.integer)('new_quantity').notNull(),
    referenceId: (0, pg_core_1.uuid)('reference_id'),
    referenceType: (0, pg_core_1.text)('reference_type'),
    performedById: (0, pg_core_1.uuid)('performed_by_id').notNull(),
    occurredAt: (0, pg_core_1.timestamp)('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=inventory.schema.js.map