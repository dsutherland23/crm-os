import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from '../database/database.module.js';
import { getTenantContext } from '../tenant/tenant.context.js';
import * as schema from '@crm-os/db';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import {
  SaleCompletedEventSchema,
  RefundIssuedEventSchema,
  InventoryChangedEventSchema,
  InvoiceCreatedEventSchema,
  PaymentCapturedEventSchema,
  CustomerUpdatedEventSchema,
  type DomainEventType,
} from '@crm-os/event-contracts';
import { z } from 'zod';

const EVENT_SCHEMAS: Record<DomainEventType, z.ZodSchema> = {
  SALE_COMPLETED: SaleCompletedEventSchema,
  REFUND_ISSUED: RefundIssuedEventSchema,
  INVENTORY_CHANGED: InventoryChangedEventSchema,
  INVOICE_CREATED: InvoiceCreatedEventSchema,
  PAYMENT_CAPTURED: PaymentCapturedEventSchema,
  CUSTOMER_UPDATED: CustomerUpdatedEventSchema,
};

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Emit a domain event.
   * 1. Validates payload against Zod schema
   * 2. Writes to transactional outbox (same DB tx as caller ideally)
   * 3. Emits in-process via EventEmitter2
   */
  async emit<T extends DomainEventType>(
    eventType: T,
    payload: unknown,
  ): Promise<void> {
    // Validate payload
    const eventSchema = EVENT_SCHEMAS[eventType];
    if (!eventSchema) {
      this.logger.error(`No schema registered for event type: ${eventType}`);
      throw new Error(`Unknown event type: ${eventType}`);
    }

    const validated = eventSchema.parse(payload);

    // Write to outbox (transactional durability)
    await this.db.insert(schema.eventOutbox).values({
      tenantId: validated.tenantId as string,
      eventType,
      payload: validated as Record<string, unknown>,
      idempotencyKey: randomUUID(),
      status: 'pending',
    });

    // Emit in-process
    this.emitter.emit(eventType, validated);
    this.logger.debug(`Event emitted: ${eventType}`);
  }
}
