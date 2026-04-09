import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomersRepository } from './customers.repository.js';
import { EventBusService } from '../../core/events/event-bus.service.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { randomUUID } from 'crypto';

function encryptPii(value: string): string {
  // TODO: Replace with AES-256-GCM encryption
  return Buffer.from(value).toString('base64');
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly repo: CustomersRepository,
    private readonly eventBus: EventBusService,
  ) {}

  findAll() {
    return this.repo.findAll();
  }

  async findById(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  async create(dto: CreateCustomerDto) {
    const customer = await this.repo.create({
      firstNameEncrypted: encryptPii(dto.firstName),
      lastNameEncrypted: encryptPii(dto.lastName),
      ...(dto.email !== undefined && {
        emailEncrypted: encryptPii(dto.email),
        email: dto.email,
      }),
      ...(dto.phone !== undefined && { phoneEncrypted: encryptPii(dto.phone) }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
    });

    const ctx = getTenantContext();
    await this.eventBus.emit('CUSTOMER_UPDATED', {
      eventId: randomUUID(),
      eventType: 'CUSTOMER_UPDATED',
      occurredAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      payload: {
        customerId: customer.id,
        changedFields: ['created'],
        updatedById: ctx.userId,
      },
    });

    return customer;
  }

  async eraseGdpr(id: string) {
    await this.findById(id);
    await this.repo.pseudonymize(id);
    return { message: 'Customer data pseudonymized per GDPR erasure request' };
  }

  addLoyaltyPoints(id: string, points: number) {
    return this.repo.addLoyaltyPoints(id, points);
  }
}
