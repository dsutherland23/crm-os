import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationPayload {
  to: string;
  subject?: string;
  body: string;
  type: 'email' | 'whatsapp';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<void> {
    if (payload.type === 'whatsapp') {
      await this.sendWhatsApp(payload);
    } else {
      await this.sendEmail(payload);
    }
  }

  private async sendWhatsApp(payload: NotificationPayload): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_API_TOKEN');
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_ID');

    if (!token || !phoneId) {
      this.logger.warn('WhatsApp not configured — skipping notification');
      return;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: payload.to,
            type: 'text',
            text: { body: payload.body },
          }),
        },
      );

      if (!res.ok) {
        this.logger.error(`WhatsApp send failed: ${res.status}`);
      }
    } catch (err) {
      this.logger.error(`WhatsApp error: ${String(err)}`);
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    // TODO: wire up Nodemailer with SMTP config from ConfigService
    this.logger.log(`Email notification queued to: ${payload.to}`);
  }
}
