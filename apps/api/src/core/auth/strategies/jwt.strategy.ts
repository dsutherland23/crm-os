import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;       // userId (UUID)
  tenantId: string;  // companyId (UUID)
  role: string;
  branchId?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: 'crm-os',
      audience: 'crm-os-api',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.tenantId || !payload.role) {
      throw new UnauthorizedException('Invalid token claims');
    }
    return payload;
  }
}
