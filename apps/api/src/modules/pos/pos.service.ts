import { Injectable } from '@nestjs/common';
import { PosRepository } from './pos.repository.js';
import { EventBusService } from '../../core/events/event-bus.service.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { CreatePosTransactionDto } from './dto/create-transaction.dto.js';
import { randomUUID } from 'crypto';

@Injectable()
export class PosService {
  constructor(
    private readonly repo: PosRepository,
    private readonly eventBus: EventBusService,
  ) {}

  openSession(cashierId: string, branchId: string, openingCashCents: number) {
    return this.repo.openSession(cashierId, branchId, openingCashCents);
  }

  closeSession(sessionId: string, closingCashCents: number) {
    return this.repo.closeSession(sessionId, closingCashCents);
  }

  async createTransaction(dto: CreatePosTransactionDto, cashierId: string, branchId: string) {
    const ctx = getTenantContext();

    const transaction = await this.repo.createTransaction({
      offlineId: dto.offlineId,
      tenantId: ctx.tenantId,
      posSessionId: dto.posSessionId,
      customerId: dto.customerId ?? null,
      subtotalCents: dto.subtotalCents,
      taxCents: dto.taxCents,
      discountCents: dto.discountCents,
      totalCents: dto.totalCents,
      payments: [{ method: dto.paymentMethod, amountCents: dto.totalCents }],
      syncedFromOffline: false,
    });

    // null = duplicate offline_id — safe to return success (idempotent)
    if (!transaction) return { deduplicated: true };

    // Persist line items
    await this.repo.createTransactionItems(
      dto.items.map((item) => ({
        tenantId: ctx.tenantId,
        transactionId: transaction.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        name: item.name,
        sku: null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents,
        totalCents: item.totalCents,
      })),
    );

    // Emit SALE_COMPLETED event — triggers inventory, finance, CRM updates
    await this.eventBus.emit('SALE_COMPLETED', {
      eventId: randomUUID(),
      eventType: 'SALE_COMPLETED',
      occurredAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      payload: {
        transactionId: transaction.id,
        posSessionId: dto.posSessionId,
        customerId: dto.customerId,
        branchId,
        items: dto.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPriceCents / 100,
          discount: i.discountCents / 100,
          total: i.totalCents / 100,
        })),
        subtotal: dto.subtotalCents / 100,
        taxAmount: dto.taxCents / 100,
        discountAmount: dto.discountCents / 100,
        totalAmount: dto.totalCents / 100,
        paymentMethod: dto.paymentMethod as 'cash',
        cashierId,
      },
    });

    return transaction;
  }

  getSessionTransactions(sessionId: string) {
    return this.repo.getSessionTransactions(sessionId);
  }
}
