"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleCompletedEventSchema = void 0;
const zod_1 = require("zod");
exports.SaleCompletedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('SALE_COMPLETED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        transactionId: zod_1.z.string().uuid(),
        posSessionId: zod_1.z.string().uuid(),
        customerId: zod_1.z.string().uuid().optional(),
        branchId: zod_1.z.string().uuid(),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string().uuid(),
            variantId: zod_1.z.string().uuid().optional(),
            quantity: zod_1.z.number().int().positive(),
            unitPrice: zod_1.z.number().nonnegative(),
            discount: zod_1.z.number().nonnegative().default(0),
            total: zod_1.z.number().nonnegative(),
        })),
        subtotal: zod_1.z.number().nonnegative(),
        taxAmount: zod_1.z.number().nonnegative(),
        discountAmount: zod_1.z.number().nonnegative(),
        totalAmount: zod_1.z.number().nonnegative(),
        paymentMethod: zod_1.z.enum(['cash', 'card', 'mixed', 'digital']),
        cashierId: zod_1.z.string().uuid(),
    }),
});
//# sourceMappingURL=sale.events.js.map