import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';

@Module({
  providers: [StripeService],
  controllers: [StripeWebhookController],
  exports: [StripeService],
})
export class BillingModule {}
