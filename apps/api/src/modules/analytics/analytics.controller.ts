import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard)
@FeatureModule('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  dashboard() {
    return this.service.getDashboardKpis();
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top-selling products' })
  topProducts(@Query('limit') limit?: string) {
    return this.service.getTopProducts(limit ? parseInt(limit, 10) : 10);
  }
}
