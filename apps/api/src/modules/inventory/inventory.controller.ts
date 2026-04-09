import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { InventoryService } from './inventory.service.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import type { JwtPayload } from '../../core/auth/strategies/jwt.strategy.js';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard, RbacGuard)
@FeatureModule('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('location/:locationId')
  @ApiOperation({ summary: 'Get inventory by location' })
  findByLocation(@Param('locationId', ParseUUIDPipe) locationId: string) {
    return this.service.findByLocation(locationId);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low-stock items' })
  lowStock() {
    return this.service.findLowStock();
  }

  @Get('movements/:productId')
  @ApiOperation({ summary: 'Get stock movement history for a product' })
  movements(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.service.getMovements(productId);
  }

  @Post('adjust')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Manually adjust stock level' })
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: JwtPayload) {
    return this.service.adjustStock(dto, user.sub);
  }
}
