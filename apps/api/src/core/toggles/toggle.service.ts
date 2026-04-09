import { Injectable, Inject } from '@nestjs/common';
import { MODULE_MANIFESTS, ModuleId } from '@crm-os/module-sdk';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../database/database.module.js';

export interface ToggleResolution {
  moduleId: ModuleId;
  enabled: boolean;
  resolvedAt: 'always_on' | 'user' | 'role' | 'tenant' | 'default';
}

@Injectable()
export class ToggleService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  /** Resolve whether a module is enabled for a given context */
  async isEnabled(
    moduleId: ModuleId,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<ToggleResolution> {
    const manifest = MODULE_MANIFESTS[moduleId];

    // Core is always on
    if (manifest.alwaysOn) {
      return { moduleId, enabled: true, resolvedAt: 'always_on' };
    }

    // Check all dependencies are enabled
    for (const dep of manifest.dependencies) {
      const depResult = await this.isEnabled(dep, tenantId, userId, userRole);
      if (!depResult.enabled) {
        return { moduleId, enabled: false, resolvedAt: 'tenant' };
      }
    }

    // Fetch tenant-level flag from DB
    const [flag] = await this.db
      .select()
      .from(schema.featureFlags)
      .where(
        and(
          eq(schema.featureFlags.tenantId, tenantId),
          eq(schema.featureFlags.moduleId, moduleId),
        ),
      )
      .limit(1);

    if (!flag) {
      return { moduleId, enabled: manifest.defaultEnabled, resolvedAt: 'default' };
    }

    // User-level override
    const userOverrides = (flag.enabledForUsers as string[]) ?? [];
    if (userOverrides.includes(userId)) {
      return { moduleId, enabled: true, resolvedAt: 'user' };
    }

    // Role-level override
    const roleOverrides = (flag.enabledForRoles as string[]) ?? [];
    if (roleOverrides.includes(userRole)) {
      return { moduleId, enabled: true, resolvedAt: 'role' };
    }

    return { moduleId, enabled: flag.enabled, resolvedAt: 'tenant' };
  }
}
