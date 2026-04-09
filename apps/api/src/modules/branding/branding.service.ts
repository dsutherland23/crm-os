import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';

@Injectable()
export class BrandingService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  async getBranding() {
    const ctx = getTenantContext();
    const [company] = await this.db
      .select({ name: schema.companies.name, logoUrl: schema.companies.logoUrl, settings: schema.companies.settings })
      .from(schema.companies)
      .where(eq(schema.companies.id, ctx.tenantId))
      .limit(1);
    return company ?? {};
  }

  async updateBranding(data: { logoUrl?: string; settings?: Record<string, unknown> }) {
    const ctx = getTenantContext();
    const updateData: Partial<typeof schema.companies.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.settings !== undefined) updateData.settings = data.settings;

    const [updated] = await this.db
      .update(schema.companies)
      .set(updateData)
      .where(eq(schema.companies.id, ctx.tenantId))
      .returning();
    return updated;
  }
}
