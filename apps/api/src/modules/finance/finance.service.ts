import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceRepository } from './finance.repository.js';
import { EventBusService } from '../../core/events/event-bus.service.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { randomUUID } from 'crypto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly eventBus: EventBusService,
  ) {}

  findInvoices() {
    return this.repo.findInvoices();
  }

  async findInvoiceById(id: string) {
    const inv = await this.repo.findInvoiceById(id);
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const ctx = getTenantContext();
    const invoice = await this.repo.createInvoice({
      tenantId: ctx.tenantId,
      invoiceNumber: `INV-${Date.now()}`,
      customerId: dto.customerId ?? null,
      subtotalCents: dto.subtotalCents,
      taxCents: dto.taxCents,
      discountCents: dto.discountCents,
      totalCents: dto.totalCents,
      currency: dto.currency ?? 'EUR',
      notes: dto.notes ?? null,
      status: 'draft',
    });

    await this.eventBus.emit('INVOICE_CREATED', {
      eventId: randomUUID(),
      eventType: 'INVOICE_CREATED',
      occurredAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      payload: {
        invoiceId: invoice.id,
        customerId: dto.customerId ?? '',
        totalAmount: dto.totalCents / 100,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: dto.currency ?? 'EUR',
      },
    });

    return invoice;
  }

  getJournalEntries() {
    return this.repo.findJournalEntries();
  }

  getChartOfAccounts() {
    return this.repo.getChartOfAccounts();
  }
}
