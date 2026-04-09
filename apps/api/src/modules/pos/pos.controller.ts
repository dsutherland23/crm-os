import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { FeatureToggleGuard, FeatureModule } from '../../core/toggles/feature-toggle.guard.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import { PosService } from './pos.service.js';
import { CreatePosTransactionDto } from './dto/create-transaction.dto.js';
import type { JwtPayload } from '../../core/auth/strategies/jwt.strategy.js';

@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureToggleGuard)
@FeatureModule('pos')
@Controller('pos')
export class PosController {
  constructor(private readonly service: PosService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Open a POS session' })
  openSession(
    @Body() body: { branchId: string; openingCashCents: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.openSession(user.sub, body.branchId, body.openingCashCents);
  }

  @Post('sessions/:id/close')
  @ApiOperation({ summary: 'Close a POS session' })
  closeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { closingCashCents: number },
  ) {
    return this.service.closeSession(id, body.closingCashCents);
  }

  @Post('transactions')
  @Throttle({ short: { limit: 20, ttl: 1000 } })
  @ApiOperation({ summary: 'Create a POS transaction (supports offline sync)' })
  createTransaction(
    @Body() dto: CreatePosTransactionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createTransaction(dto, user.sub, user.branchId ?? '');
  }

  @Get('sessions/:id/transactions')
  @ApiOperation({ summary: 'Get all transactions for a session' })
  sessionTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSessionTransactions(id);
  }
}
