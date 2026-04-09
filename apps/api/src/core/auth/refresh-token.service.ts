import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly config: ConfigService) {}

  /** Generate a cryptographically random refresh token */
  generateToken(): string {
    return randomBytes(64).toString('hex');
  }

  /** Hash the token for secure storage (never store plaintext) */
  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 12);
  }

  /** Compare plaintext token against stored hash */
  async verifyToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }
}
