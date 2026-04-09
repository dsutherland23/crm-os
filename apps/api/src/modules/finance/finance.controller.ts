import {
  Controller, Get, Post, Body, Param,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { FinanceService } from './finance.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard, RbacGuard)
@FeatureModule('finance')
@Roles('accountant', 'admin')
@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List all invoices' })
  findInvoices() {
    return this.service.findInvoices();
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findInvoiceById(id);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create an invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.service.createInvoice(dto);
  }

  @Get('journal')
  @ApiOperation({ summary: 'Get journal entries' })
  journalEntries() {
    return this.service.getJournalEntries();
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Get chart of accounts' })
  chartOfAccounts() {
    return this.service.getChartOfAccounts();
  }
}
