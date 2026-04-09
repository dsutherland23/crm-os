import { z } from 'zod';

export const InventoryChangedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('INVENTORY_CHANGED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    locationId: z.string().uuid(),
    previousQuantity: z.number().int(),
    newQuantity: z.number().int(),
    changeType: z.enum(['sale', 'refund', 'restock', 'transfer', 'adjustment', 'damage']),
    referenceId: z.string().uuid().optional(),
  }),
});

export type InventoryChangedEvent = z.infer<typeof InventoryChangedEventSchema>;
