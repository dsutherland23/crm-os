import { z } from 'zod';

export const InvoiceCreatedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('INVOICE_CREATED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    invoiceId: z.string().uuid(),
    customerId: z.string().uuid(),
    totalAmount: z.number().nonnegative(),
    dueDate: z.string().datetime(),
    currency: z.string().length(3),
  }),
});

export const PaymentCapturedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('PAYMENT_CAPTURED'),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  payload: z.object({
    paymentId: z.string().uuid(),
    invoiceId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    amount: z.number().positive(),
    currency: z.string().length(3),
    method: z.enum(['stripe', 'cash', 'bank_transfer', 'crypto']),
    stripePaymentIntentId: z.string().optional(),
  }),
});

export type InvoiceCreatedEvent = z.infer<typeof InvoiceCreatedEventSchema>;
export type PaymentCapturedEvent = z.infer<typeof PaymentCapturedEventSchema>;
