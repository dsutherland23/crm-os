import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { ToggleModule } from './toggles/toggle.module.js';
import { AuditModule } from './audit/audit.module.js';
import { EventBusModule } from './events/event-bus.module.js';
import { DatabaseModule } from './database/database.module.js';

@Global()
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
    ToggleModule,
    AuditModule,
    EventBusModule,
  ],
  exports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
    ToggleModule,
    AuditModule,
    EventBusModule,
  ],
})
export class CoreModule {}
