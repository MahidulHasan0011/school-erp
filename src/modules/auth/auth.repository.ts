import { Injectable } from '@nestjs/common';

/**
 * Placeholder for auth-specific persistence (e.g. refresh tokens, sessions,
 * password-reset tokens). Wire up a dedicated entity + TypeOrmModule.forFeature
 * here when those features are implemented.
 */
@Injectable()
export class AuthRepository {
  // Example (to implement later):
  // saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {}
  // findValidRefreshToken(userId: string, tokenHash: string) {}
  // revokeRefreshToken(userId: string) {}
}
