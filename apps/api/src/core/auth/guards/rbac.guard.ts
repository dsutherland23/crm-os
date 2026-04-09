import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  accountant: 50,
  staff: 20,
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const hasAccess = requiredRoles.some((r) => userLevel >= (ROLE_HIERARCHY[r] ?? 0));

    if (!hasAccess) {
      throw new ForbiddenException(`Role '${user.role}' is not authorized for this action`);
    }

    return true;
  }
}
