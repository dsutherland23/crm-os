import { Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lte, gte, isNull, or } from 'drizzle-orm';
import * as schema from '@crm-os/db';
import { Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

export interface PriceResult {
  priceCents: number;
  resolvedBy: 'customer_override' | 'tier_price' | 'active_promo' | 'default';
}

@Injectable()
export class PricingEngine {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Deterministic price resolution.
   * Order: customer_override > tier_price > active_promo > default
   */
  async evaluate(
    productId: string,
    variantId: string | undefined,
    customerId: string | undefined,
    quantity: number,
  ): Promise<PriceResult> {
    const ctx = getTenantContext();
    const now = new Date();

    // 1. Customer-specific override
    if (customerId) {
      const conditions = [
        eq(schema.customerPriceOverrides.tenantId, ctx.tenantId),
        eq(schema.customerPriceOverrides.customerId, customerId),
        eq(schema.customerPriceOverrides.productId, productId),
        or(isNull(schema.customerPriceOverrides.validFrom), lte(schema.customerPriceOverrides.validFrom, now)),
        or(isNull(schema.customerPriceOverrides.validTo), gte(schema.customerPriceOverrides.validTo, now)),
      ];

      const [override] = await this.db
        .select()
        .from(schema.customerPriceOverrides)
        .where(and(...conditions))
        .limit(1);

      if (override) {
        return { priceCents: override.priceCents, resolvedBy: 'customer_override' };
      }
    }

    // 2 & 3. Rules (tier / promo / default) — sorted by priority
    const rules = await this.db
      .select()
      .from(schema.priceRules)
      .where(
        and(
          eq(schema.priceRules.tenantId, ctx.tenantId),
          eq(schema.priceRules.productId, productId),
          eq(schema.priceRules.isActive, true),
          lte(schema.priceRules.minQuantity, quantity),
          or(isNull(schema.priceRules.validFrom), lte(schema.priceRules.validFrom, now)),
          or(isNull(schema.priceRules.validTo), gte(schema.priceRules.validTo, now)),
        ),
      );

    // tier first, then promo, then default
    const tier = rules.find((r) => r.ruleType === 'tier' || r.ruleType === 'wholesale');
    if (tier) return { priceCents: tier.priceCents, resolvedBy: 'tier_price' };

    const promo = rules.find((r) => r.ruleType === 'promo');
    if (promo) {
      const discounted = Math.round(promo.priceCents * (1 - (promo.discountPercent ?? 0) / 100));
      return { priceCents: discounted, resolvedBy: 'active_promo' };
    }

    const def = rules.find((r) => r.ruleType === 'default' || r.ruleType === 'retail');
    if (def) return { priceCents: def.priceCents, resolvedBy: 'default' };

    return { priceCents: 0, resolvedBy: 'default' };
  }
}
