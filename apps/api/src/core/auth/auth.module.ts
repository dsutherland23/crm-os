import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RbacGuard } from './guards/rbac.guard.js';
import { AbacGuard } from './guards/abac.guard.js';
import { FeatureToggleGuard } from '../toggles/feature-toggle.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
          issuer: 'crm-os',
          audience: 'crm-os-api',
        },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RbacGuard,
    AbacGuard,
    FeatureToggleGuard,
    AuthService,
    RefreshTokenService,
  ],
  controllers: [AuthController],
  exports: [JwtAuthGuard, RbacGuard, AbacGuard, FeatureToggleGuard, AuthService],
})
export class AuthModule {}
