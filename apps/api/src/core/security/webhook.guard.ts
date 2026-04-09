import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyRequest } from 'fastify';

const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const signature = req.headers['x-signature-256'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    // Replay protection: reject if timestamp > 5 minutes old
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Webhook timestamp outside tolerance window');
    }

    const secret = process.env['WEBHOOK_SECRET'];
    if (!secret) {
      this.logger.error('WEBHOOK_SECRET not configured');
      throw new UnauthorizedException('Webhook signing not configured');
    }

    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex');

    const expectedSig = `sha256=${expected}`;
    const receivedSig = signature;

    // Timing-safe comparison
    const expectedBuf = Buffer.from(expectedSig);
    const receivedBuf = Buffer.from(receivedSig.padEnd(expectedSig.length));

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
