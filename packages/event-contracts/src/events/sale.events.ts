import { z } from 'zod';

export const SaleCompletedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('SALE_COMPLETED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    transactionId: z.string().uuid(),
    posSessionId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    branchId: z.string().uuid(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().default(0),
        total: z.number().nonnegative(),
      }),
    ),
    subtotal: z.number().nonnegative(),
    taxAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    paymentMethod: z.enum(['cash', 'card', 'mixed', 'digital']),
    cashierId: z.string().uuid(),
  }),
});

export type SaleCompletedEvent = z.infer<typeof SaleCompletedEventSchema>;
