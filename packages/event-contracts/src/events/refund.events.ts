import { z } from 'zod';

export const RefundIssuedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('REFUND_ISSUED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    refundId: z.string().uuid(),
    originalTransactionId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    branchId: z.string().uuid(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        refundAmount: z.number().nonnegative(),
      }),
    ),
    totalRefundAmount: z.number().nonnegative(),
    reason: z.string().max(500),
    approvedById: z.string().uuid(),
  }),
});

export type RefundIssuedEvent = z.infer<typeof RefundIssuedEventSchema>;
