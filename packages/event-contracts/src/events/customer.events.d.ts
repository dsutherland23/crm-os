import { z } from 'zod';
export declare const CustomerUpdatedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"CUSTOMER_UPDATED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        customerId: z.ZodString;
        changedFields: z.ZodArray<z.ZodString, "many">;
        updatedById: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        customerId: string;
        changedFields: string[];
        updatedById: string;
    }, {
        customerId: string;
        changedFields: string[];
        updatedById: string;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "CUSTOMER_UPDATED";
    payload: {
        customerId: string;
        changedFields: string[];
        updatedById: string;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "CUSTOMER_UPDATED";
    payload: {
        customerId: string;
        changedFields: string[];
        updatedById: string;
    };
    eventId: string;
}>;
export type CustomerUpdatedEvent = z.infer<typeof CustomerUpdatedEventSchema>;
//# sourceMappingURL=customer.events.d.ts.map