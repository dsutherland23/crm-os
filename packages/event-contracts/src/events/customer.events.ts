import { z } from 'zod';

export const CustomerUpdatedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('CUSTOMER_UPDATED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    customerId: z.string().uuid(),
    changedFields: z.array(z.string()),
    updatedById: z.string().uuid(),
  }),
});

export type CustomerUpdatedEvent = z.infer<typeof CustomerUpdatedEventSchema>;
