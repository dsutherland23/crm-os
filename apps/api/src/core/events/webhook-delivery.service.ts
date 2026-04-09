import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

export interface WebhookTarget {
  url: string;
  secret: string;
}

export interface WebhookPayload {
  eventType: string;
  occurredAt: string;
  tenantId: string;
  data: unknown;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  private sign(payload: string, secret: string, timestamp: string): string {
    return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest('hex')}`;
  }

  /**
   * Deliver a webhook with exponential backoff (max 5 retries).
   * Signed with HMAC-SHA256 to allow receiver verification.
   */
  async deliver(target: WebhookTarget, payload: WebhookPayload): Promise<boolean> {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(body, target.secret, timestamp);

    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(target.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature-256': signature,
            'X-Timestamp': timestamp,
            'User-Agent': 'CRM-OS-Webhooks/1.0',
          },
          body,
        });

        if (res.ok) {
          this.logger.log(`Webhook delivered to ${target.url} (attempt ${attempt + 1})`);
          return true;
        }

        this.logger.warn(`Webhook delivery failed: ${res.status} — attempt ${attempt + 1}/${maxRetries}`);
      } catch (err) {
        this.logger.warn(`Webhook network error (attempt ${attempt + 1}): ${String(err)}`);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    this.logger.error(`Webhook delivery permanently failed for ${target.url}`);
    return false;
  }
}
