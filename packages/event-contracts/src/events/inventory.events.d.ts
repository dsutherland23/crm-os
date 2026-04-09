import { z } from 'zod';
export declare const InventoryChangedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodLiteral<"INVENTORY_CHANGED">;
    occurredAt: z.ZodString;
    tenantId: z.ZodString;
    payload: z.ZodObject<{
        productId: z.ZodString;
        variantId: z.ZodOptional<z.ZodString>;
        locationId: z.ZodString;
        previousQuantity: z.ZodNumber;
        newQuantity: z.ZodNumber;
        changeType: z.ZodEnum<["sale", "refund", "restock", "transfer", "adjustment", "damage"]>;
        referenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        locationId: string;
        changeType: "sale" | "refund" | "restock" | "transfer" | "adjustment" | "damage";
        previousQuantity: number;
        newQuantity: number;
        variantId?: string | undefined;
        referenceId?: string | undefined;
    }, {
        productId: string;
        locationId: string;
        changeType: "sale" | "refund" | "restock" | "transfer" | "adjustment" | "damage";
        previousQuantity: number;
        newQuantity: number;
        variantId?: string | undefined;
        referenceId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    occurredAt: string;
    eventType: "INVENTORY_CHANGED";
    payload: {
        productId: string;
        locationId: string;
        changeType: "sale" | "refund" | "restock" | "transfer" | "adjustment" | "damage";
        previousQuantity: number;
        newQuantity: number;
        variantId?: string | undefined;
        referenceId?: string | undefined;
    };
    eventId: string;
}, {
    tenantId: string;
    occurredAt: string;
    eventType: "INVENTORY_CHANGED";
    payload: {
        productId: string;
        locationId: string;
        changeType: "sale" | "refund" | "restock" | "transfer" | "adjustment" | "damage";
        previousQuantity: number;
        newQuantity: number;
        variantId?: string | undefined;
        referenceId?: string | undefined;
    };
    eventId: string;
}>;
export type InventoryChangedEvent = z.infer<typeof InventoryChangedEventSchema>;
//# sourceMappingURL=inventory.events.d.ts.map