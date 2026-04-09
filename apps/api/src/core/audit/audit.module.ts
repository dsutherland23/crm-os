import { Module } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor.js';

@Module({
  providers: [AuditInterceptor],
  exports: [AuditInterceptor],
})
export class AuditModule {}
