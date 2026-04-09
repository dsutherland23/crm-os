import { z } from 'zod';
export declare const RefundIssuedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"REFUND_ISSUED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        refundId: z.ZodString;
        originalTransactionId: z.ZodString;
        customerId: z.ZodOptional<z.ZodString>;
        branchId: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            productId: z.ZodString;
            variantId: z.ZodOptional<z.ZodString>;
            quantity: z.ZodNumber;
            refundAmount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }, {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }>, "many">;
        totalRefundAmount: z.ZodNumber;
        reason: z.ZodString;
        approvedById: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        branchId: string;
        items: {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }[];
        refundId: string;
        originalTransactionId: string;
        totalRefundAmount: number;
        reason: string;
        approvedById: string;
        customerId?: string | undefined;
    }, {
        branchId: string;
        items: {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }[];
        refundId: string;
        originalTransactionId: string;
        totalRefundAmount: number;
        reason: string;
        approvedById: string;
        customerId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "REFUND_ISSUED";
    payload: {
        branchId: string;
        items: {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }[];
        refundId: string;
        originalTransactionId: string;
        totalRefundAmount: number;
        reason: string;
        approvedById: string;
        customerId?: string | undefined;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "REFUND_ISSUED";
    payload: {
        branchId: string;
        items: {
            productId: string;
            quantity: number;
            refundAmount: number;
            variantId?: string | undefined;
        }[];
        refundId: string;
        originalTransactionId: string;
        totalRefundAmount: number;
        reason: string;
        approvedById: string;
        customerId?: string | undefined;
    };
    eventId: string;
}>;
export type RefundIssuedEvent = z.infer<typeof RefundIssuedEventSchema>;
//# sourceMappingURL=refund.events.d.ts.map