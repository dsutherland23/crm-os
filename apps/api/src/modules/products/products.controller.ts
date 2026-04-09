import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { FeatureToggleGuard } from '../../core/toggles/feature-toggle.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard, RbacGuard)
@FeatureModule('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'Get product variants' })
  findVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findVariants(id);
  }
}
