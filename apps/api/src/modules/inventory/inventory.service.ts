import { Injectable } from '@nestjs/common';
import { InventoryRepository } from './inventory.repository.js';
import { EventBusService } from '../../core/events/event-bus.service.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly eventBus: EventBusService,
  ) {}

  findByLocation(locationId: string) {
    return this.repo.findByLocation(locationId);
  }

  findLowStock() {
    return this.repo.findLowStock();
  }

  getMovements(productId: string) {
    return this.repo.getMovements(productId);
  }

  async adjustStock(dto: AdjustStockDto, performedById: string) {
    const ctx = getTenantContext();
    const newQty = await this.repo.adjustQuantity(
      dto.productId,
      dto.locationId,
      dto.delta,
      performedById,
      dto.changeType,
      dto.referenceId,
    );

    await this.eventBus.emit('INVENTORY_CHANGED', {
      eventId: randomUUID(),
      eventType: 'INVENTORY_CHANGED',
      occurredAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      payload: {
        productId: dto.productId,
        locationId: dto.locationId,
        previousQuantity: newQty - dto.delta,
        newQuantity: newQty,
        changeType: dto.changeType as 'adjustment',
        referenceId: dto.referenceId,
      },
    });

    return { newQuantity: newQty };
  }
}
