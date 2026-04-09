import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { PricingRepository } from './pricing.repository.js';
import { PricingEngine } from './pricing-engine.js';

@Module({
  controllers: [PricingController],
  providers: [PricingService, PricingRepository, PricingEngine],
  exports: [PricingService, PricingEngine],
})
export class PricingModule {}
