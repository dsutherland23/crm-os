import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { OperationsService } from './operations.service.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard)
@FeatureModule('operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get('returns')
  @ApiOperation({ summary: 'Get return requests' })
  returns() {
    return this.service.getReturnRequests();
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get branch transfers' })
  transfers() {
    return this.service.getTransfers();
  }
}
