import { z } from 'zod';
export declare const SaleCompletedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"SALE_COMPLETED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        transactionId: z.ZodString;
        posSessionId: z.ZodString;
        customerId: z.ZodOptional<z.ZodString>;
        branchId: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            productId: z.ZodString;
            variantId: z.ZodOptional<z.ZodString>;
            quantity: z.ZodNumber;
            unitPrice: z.ZodNumber;
            discount: z.ZodDefault<z.ZodNumber>;
            total: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
            total: number;
            variantId?: string | undefined;
        }, {
            productId: string;
            quantity: number;
            unitPrice: number;
            total: number;
            variantId?: string | undefined;
            discount?: number | undefined;
        }>, "many">;
        subtotal: z.ZodNumber;
        taxAmount: z.ZodNumber;
        discountAmount: z.ZodNumber;
        totalAmount: z.ZodNumber;
        paymentMethod: z.ZodEnum<["cash", "card", "mixed", "digital"]>;
        cashierId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        branchId: string;
        cashierId: string;
        posSessionId: string;
        transactionId: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
            total: number;
            variantId?: string | undefined;
        }[];
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paymentMethod: "cash" | "card" | "mixed" | "digital";
        customerId?: string | undefined;
    }, {
        branchId: string;
        cashierId: string;
        posSessionId: string;
        transactionId: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            total: number;
            variantId?: string | undefined;
            discount?: number | undefined;
        }[];
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paymentMethod: "cash" | "card" | "mixed" | "digital";
        customerId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "SALE_COMPLETED";
    payload: {
        branchId: string;
        cashierId: string;
        posSessionId: string;
        transactionId: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
            total: number;
            variantId?: string | undefined;
        }[];
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paymentMethod: "cash" | "card" | "mixed" | "digital";
        customerId?: string | undefined;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "SALE_COMPLETED";
    payload: {
        branchId: string;
        cashierId: string;
        posSessionId: string;
        transactionId: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            total: number;
            variantId?: string | undefined;
            discount?: number | undefined;
        }[];
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paymentMethod: "cash" | "card" | "mixed" | "digital";
        customerId?: string | undefined;
    };
    eventId: string;
}>;
export type SaleCompletedEvent = z.infer<typeof SaleCompletedEventSchema>;
//# sourceMappingURL=sale.events.d.ts.map