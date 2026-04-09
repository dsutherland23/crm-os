import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { FinanceRepository } from './finance.repository.js';
import { DoubleEntryService } from './double-entry.service.js';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository, DoubleEntryService],
  exports: [FinanceService, DoubleEntryService],
})
export class FinanceModule {}
