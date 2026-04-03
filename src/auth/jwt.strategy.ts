import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { SessionActivityService } from './session-activity.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sessionActivityService: SessionActivityService) {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    if (jwtSecret === 'super-secret-change-me') {
      throw new Error('JWT_SECRET is using an insecure default value');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: {
    sub: number;
    email: string;
    roleId: number;
    isRoot: boolean;
    permissions: string[];
    rememberMe?: boolean;
    sessionId?: string;
    iat?: number;
  }) {
    const isActive = this.sessionActivityService.assertAndTouchSession(payload);

    if (!isActive) {
      throw unauthorized('Session expired due to inactivity', ERROR_CODES.UNAUTHORIZED);
    }

    return payload;
  }
}
