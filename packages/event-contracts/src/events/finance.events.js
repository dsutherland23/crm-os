"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentCapturedEventSchema = exports.InvoiceCreatedEventSchema = void 0;
const zod_1 = require("zod");
exports.InvoiceCreatedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('INVOICE_CREATED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        invoiceId: zod_1.z.string().uuid(),
        customerId: zod_1.z.string().uuid(),
        totalAmount: zod_1.z.number().nonnegative(),
        dueDate: zod_1.z.string().datetime(),
        currency: zod_1.z.string().length(3),
    }),
});
exports.PaymentCapturedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('PAYMENT_CAPTURED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        paymentId: zod_1.z.string().uuid(),
        invoiceId: zod_1.z.string().uuid().optional(),
        customerId: zod_1.z.string().uuid().optional(),
        amount: zod_1.z.number().positive(),
        currency: zod_1.z.string().length(3),
        method: zod_1.z.enum(['stripe', 'cash', 'bank_transfer', 'crypto']),
        stripePaymentIntentId: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=finance.events.js.map