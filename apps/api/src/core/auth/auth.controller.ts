import { Controller, Post, Body, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { PublicRoute } from './decorators/public-route.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @PublicRoute()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login (BYPASS MODE - any email/password works)' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    // BYPASS MODE: Always authenticate as demo admin
    const payload = {
      sub: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', // demo user ID
      tenantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // demo company
      role: 'admin',
      branchId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    };

    const accessToken = this.authService.signAccessToken(payload);
    const refreshToken = 'demo-refresh-token-bypass';

    // Set httpOnly refresh cookie
    void res.header(
      'Set-Cookie',
      `refresh_token=${refreshToken}; Path=/; HttpOnly; Max-Age=604800; SameSite=Strict`,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes
      user: {
        id: payload.sub,
        email: dto.email,
        role: payload.role,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
      },
    };
  }

  @Post('refresh')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh token (BYPASS MODE)' })
  async refresh() {
    // BYPASS MODE: Return same demo token
    const payload = {
      sub: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      tenantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      role: 'admin',
      branchId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    };

    return {
      access_token: this.authService.signAccessToken(payload),
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout' })
  async logout(@CurrentUser() _user: JwtPayload, @Res({ passthrough: true }) res: FastifyReply) {
    void res.header('Set-Cookie', 'refresh_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict');
  }

  @PublicRoute()
  @Post('bypass-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One-click bypass login (no credentials needed)' })
  async bypassLogin(@Res({ passthrough: true }) res: FastifyReply) {
    const payload = {
      sub: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      tenantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      role: 'admin',
      branchId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    };

    const accessToken = this.authService.signAccessToken(payload);

    void res.header(
      'Set-Cookie',
      `refresh_token=demo-refresh; Path=/; HttpOnly; Max-Age=604800; SameSite=Strict`,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: payload.sub,
        email: 'admin@demo.com',
        role: payload.role,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
      },
    };
  }
}
