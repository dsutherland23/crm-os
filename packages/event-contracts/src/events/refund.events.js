"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundIssuedEventSchema = void 0;
const zod_1 = require("zod");
exports.RefundIssuedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('REFUND_ISSUED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        refundId: zod_1.z.string().uuid(),
        originalTransactionId: zod_1.z.string().uuid(),
        customerId: zod_1.z.string().uuid().optional(),
        branchId: zod_1.z.string().uuid(),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string().uuid(),
            variantId: zod_1.z.string().uuid().optional(),
            quantity: zod_1.z.number().int().positive(),
            refundAmount: zod_1.z.number().nonnegative(),
        })),
        totalRefundAmount: zod_1.z.number().nonnegative(),
        reason: zod_1.z.string().max(500),
        approvedById: zod_1.z.string().uuid(),
    }),
});
//# sourceMappingURL=refund.events.js.map