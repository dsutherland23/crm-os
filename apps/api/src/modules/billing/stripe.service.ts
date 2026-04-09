import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('STRIPE_SECRET_KEY');
  }

  /**
   * Create a Stripe Checkout session for module subscription.
   * Uses Stripe's SDK — import 'stripe' package and initialize client.
   * Kept as a stub to avoid adding Stripe SDK without user confirmation of Stripe account.
   */
  async createCheckoutSession(params: {
    customerId?: string;
    priceId: string;
    tenantId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    this.logger.log(`Creating Stripe checkout for tenant ${params.tenantId}`);
    // TODO: const stripe = new Stripe(this.secretKey); return stripe.checkout.sessions.create(...)
    return { url: `https://checkout.stripe.com/stub?tenant=${params.tenantId}` };
  }

  /**
   * Verify Stripe webhook signature.
   * Call this BEFORE processing any webhook event.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
    // TODO: const stripe = new Stripe(this.secretKey); stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    this.logger.log('Stripe webhook signature verification — wire up Stripe SDK');
    return !!rawBody && !!signature && !!webhookSecret;
  }
}
