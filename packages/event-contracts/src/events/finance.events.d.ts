import { z } from 'zod';
export declare const InvoiceCreatedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"INVOICE_CREATED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        invoiceId: z.ZodString;
        customerId: z.ZodString;
        totalAmount: z.ZodNumber;
        dueDate: z.ZodString;
        currency: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        customerId: string;
        currency: string;
        invoiceId: string;
        totalAmount: number;
        dueDate: string;
    }, {
        customerId: string;
        currency: string;
        invoiceId: string;
        totalAmount: number;
        dueDate: string;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "INVOICE_CREATED";
    payload: {
        customerId: string;
        currency: string;
        invoiceId: string;
        totalAmount: number;
        dueDate: string;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "INVOICE_CREATED";
    payload: {
        customerId: string;
        currency: string;
        invoiceId: string;
        totalAmount: number;
        dueDate: string;
    };
    eventId: string;
}>;
export declare const PaymentCapturedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"PAYMENT_CAPTURED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        paymentId: z.ZodString;
        invoiceId: z.ZodOptional<z.ZodString>;
        customerId: z.ZodOptional<z.ZodString>;
        amount: z.ZodNumber;
        currency: z.ZodString;
        method: z.ZodEnum<["stripe", "cash", "bank_transfer", "crypto"]>;
        stripePaymentIntentId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        method: "cash" | "stripe" | "bank_transfer" | "crypto";
        paymentId: string;
        amount: number;
        customerId?: string | undefined;
        invoiceId?: string | undefined;
        stripePaymentIntentId?: string | undefined;
    }, {
        currency: string;
        method: "cash" | "stripe" | "bank_transfer" | "crypto";
        paymentId: string;
        amount: number;
        customerId?: string | undefined;
        invoiceId?: string | undefined;
        stripePaymentIntentId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "PAYMENT_CAPTURED";
    payload: {
        currency: string;
        method: "cash" | "stripe" | "bank_transfer" | "crypto";
        paymentId: string;
        amount: number;
        customerId?: string | undefined;
        invoiceId?: string | undefined;
        stripePaymentIntentId?: string | undefined;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "PAYMENT_CAPTURED";
    payload: {
        currency: string;
        method: "cash" | "stripe" | "bank_transfer" | "crypto";
        paymentId: string;
        amount: number;
        customerId?: string | undefined;
        invoiceId?: string | undefined;
        stripePaymentIntentId?: string | undefined;
    };
    eventId: string;
}>;
export type InvoiceCreatedEvent = z.infer<typeof InvoiceCreatedEventSchema>;
export type PaymentCapturedEvent = z.infer<typeof PaymentCapturedEventSchema>;
//# sourceMappingURL=finance.events.d.ts.map