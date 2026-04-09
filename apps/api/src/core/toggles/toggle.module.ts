import { Module } from '@nestjs/common';
import { ToggleService } from './toggle.service.js';
import { FeatureToggleGuard } from './feature-toggle.guard.js';

@Module({
  providers: [ToggleService, FeatureToggleGuard],
  exports: [ToggleService, FeatureToggleGuard],
})
export class ToggleModule {}
