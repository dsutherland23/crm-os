import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { BrandingService } from './branding.service.js';
import { IsOptional, IsString, IsUrl } from 'class-validator';

class UpdateBrandingDto {
  @IsOptional() @IsUrl() logoUrl?: string;
  @IsOptional() settings?: Record<string, unknown>;
}

@ApiTags('branding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard, RbacGuard)
@FeatureModule('branding')
@Controller('branding')
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get()
  @ApiOperation({ summary: 'Get company branding settings' })
  getBranding() {
    return this.service.getBranding();
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update branding settings' })
  updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.service.updateBranding(dto);
  }
}
