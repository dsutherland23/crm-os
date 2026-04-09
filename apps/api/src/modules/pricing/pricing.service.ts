import { Injectable } from '@nestjs/common';
import { PricingRepository } from './pricing.repository.js';
import { PricingEngine } from './pricing-engine.js';

@Injectable()
export class PricingService {
  constructor(
    private readonly repo: PricingRepository,
    private readonly engine: PricingEngine,
  ) {}

  findRules() {
    return this.repo.findRules();
  }

  evaluate(productId: string, variantId?: string, customerId?: string, quantity = 1) {
    return this.engine.evaluate(productId, variantId, customerId, quantity);
  }
}
