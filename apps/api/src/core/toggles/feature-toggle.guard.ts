import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ToggleService } from './toggle.service.js';
import type { ModuleId } from '@crm-os/module-sdk';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

export const FEATURE_MODULE_KEY = 'featureModule';

// Use SetMetadata directly — avoids custom decorator return type issues
export const FeatureModule = (moduleId: ModuleId) => SetMetadata(FEATURE_MODULE_KEY, moduleId);

@Injectable()
export class FeatureToggleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly toggleService: ToggleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<ModuleId | undefined>(FEATURE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!moduleId) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const result = await this.toggleService.isEnabled(
      moduleId,
      user.tenantId,
      user.sub,
      user.role,
    );

    if (!result.enabled) {
      throw new ForbiddenException(`Module '${moduleId}' is not enabled for your account`);
    }

    return true;
  }
}
