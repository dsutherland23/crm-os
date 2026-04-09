import { SetMetadata } from '@nestjs/common';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

export interface PolicyRule {
  name: string;
  evaluate: (user: JwtPayload, body: unknown) => boolean;
}

export const POLICY_KEY = 'abac_policies';
export const Policy = (...policies: PolicyRule[]) => SetMetadata(POLICY_KEY, policies);
