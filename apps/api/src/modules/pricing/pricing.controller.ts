import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { PricingService } from './pricing.service.js';
import { IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class EvaluatePriceQuery {
  @ApiPropertyOptional() @IsUUID() @IsOptional() customerId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() variantId?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() quantity?: number;
}

@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard, RbacGuard)
@FeatureModule('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List all pricing rules' })
  findRules() {
    return this.service.findRules();
  }

  @Get('evaluate/:productId')
  @ApiOperation({ summary: 'Evaluate price for a product' })
  evaluate(
    @Query('productId') productId: string,
    @Query() query: EvaluatePriceQuery,
  ) {
    return this.service.evaluate(
      productId,
      query.variantId,
      query.customerId,
      query.quantity ? Number(query.quantity) : 1,
    );
  }
}
