import { Module } from '@nestjs/common';
import { GdprController } from './gdpr.controller.js';
import { GdprService } from './gdpr.service.js';

@Module({
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
