import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CoreModule } from './core/core.module.js';
import { TenantMiddleware } from './core/tenant/tenant.middleware.js';
import { ProductsModule } from './modules/products/products.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PosModule } from './modules/pos/pos.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { BrandingModule } from './modules/branding/branding.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { GdprModule } from './modules/gdpr/gdpr.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long', ttl: 60000, limit: 500 },
    ]),
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),

    CoreModule,
    ProductsModule,
    InventoryModule,
    CrmModule,
    FinanceModule,
    PosModule,
    PricingModule,
    AnalyticsModule,
    OperationsModule,
    BrandingModule,
    BillingModule,
    NotificationsModule,
    GdprModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply TenantMiddleware to all routes except public auth endpoints
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/login', method: RequestMethod.POST },
        { path: 'api/v1/auth/refresh', method: RequestMethod.POST },
        { path: 'api/v1/auth/bypass-login', method: RequestMethod.POST },
        { path: 'api/v1/billing/stripe/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
