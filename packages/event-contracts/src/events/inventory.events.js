"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryChangedEventSchema = void 0;
const zod_1 = require("zod");
exports.InventoryChangedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('INVENTORY_CHANGED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        productId: zod_1.z.string().uuid(),
        variantId: zod_1.z.string().uuid().optional(),
        locationId: zod_1.z.string().uuid(),
        previousQuantity: zod_1.z.number().int(),
        newQuantity: zod_1.z.number().int(),
        changeType: zod_1.z.enum(['sale', 'refund', 'restock', 'transfer', 'adjustment', 'damage']),
        referenceId: zod_1.z.string().uuid().optional(),
    }),
});
//# sourceMappingURL=inventory.events.js.map