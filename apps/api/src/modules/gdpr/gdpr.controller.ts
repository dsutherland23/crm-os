import { Controller, Get, Delete, Param, UseGuards, ParseUUIDPipe, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../core/auth/guards/rbac.guard.js';
import { Roles } from '../../core/auth/decorators/roles.decorator.js';
import { Throttle } from '@nestjs/throttler';
import { GdprService } from './gdpr.service.js';

@ApiTags('gdpr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Roles('admin')
@Controller('gdpr')
export class GdprController {
  constructor(private readonly service: GdprService) {}

  @Get('export/:customerId')
  @Throttle({ long: { limit: 10, ttl: 3600000 } }) // 10 exports per hour
  @ApiOperation({ summary: 'GDPR Article 15 — Export all customer data' })
  async export(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const data = await this.service.exportCustomerData(customerId);
    res.header('Content-Disposition', `attachment; filename="gdpr-export-${customerId}.json"`);
    res.header('Content-Type', 'application/json');
    return data;
  }

  @Delete('erase/:customerId')
  @Throttle({ long: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'GDPR Article 17 — Erase customer PII (pseudonymize)' })
  erase(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.service.eraseCustomerData(customerId);
  }
}
