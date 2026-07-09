import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes using the 'jwt' Passport strategy.
 * Usage: `@UseGuards(JwtAuthGuard)`
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
