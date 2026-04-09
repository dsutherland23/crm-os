import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICY_KEY, PolicyRule } from '../decorators/policy.decorator.js';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policies = this.reflector.getAllAndOverride<PolicyRule[]>(POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policies || policies.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload; body: unknown }>();
    const user = request.user;

    for (const policy of policies) {
      if (!policy.evaluate(user, request.body)) {
        throw new ForbiddenException(`Policy '${policy.name}' denied access`);
      }
    }

    return true;
  }
}
