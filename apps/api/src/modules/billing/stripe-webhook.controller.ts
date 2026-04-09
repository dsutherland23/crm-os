import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicRoute } from '../../core/auth/decorators/public-route.decorator.js';
import { StripeService } from './stripe.service.js';
import { FastifyRequest, FastifyReply } from 'fastify';

@ApiTags('billing')
@Controller('billing')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Post('stripe/webhook')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  async handleStripeWebhook(
    @Req() req: FastifyRequest,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new BadRequestException('Raw body required');

    const isValid = this.stripeService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) throw new BadRequestException('Invalid Stripe webhook signature');

    const event = req.body as { type: string; data: unknown };
    this.logger.log(`Stripe event received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: activate modules for tenant based on purchased plan
        break;
      case 'invoice.payment_failed':
        // TODO: notify tenant of payment failure
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }
}
