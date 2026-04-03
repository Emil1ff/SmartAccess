import { Injectable } from '@nestjs/common';

const ONE_HOUR_MS = 60 * 60 * 1000;

type SessionPayload = {
  sessionId?: string;
  rememberMe?: boolean;
  iat?: number;
};

@Injectable()
export class SessionActivityService {
  private readonly lastActivityBySession = new Map<string, number>();
  private readonly revokedSessions = new Set<string>();

  registerSession(sessionId: string) {
    this.revokedSessions.delete(sessionId);
    this.lastActivityBySession.set(sessionId, Date.now());
  }

  clearSession(sessionId?: string) {
    if (!sessionId) {
      return;
    }

    this.lastActivityBySession.delete(sessionId);
    this.revokedSessions.add(sessionId);
  }

  assertAndTouchSession(payload: SessionPayload): boolean {
    const sessionId = payload.sessionId;
    if (!sessionId) {
      return false;
    }

    if (this.revokedSessions.has(sessionId)) {
      return false;
    }

    if (payload.rememberMe) {
      return true;
    }

    const now = Date.now();
    const createdAt = typeof payload.iat === 'number' ? payload.iat * 1000 : now;
    const lastActivity = this.lastActivityBySession.get(sessionId) ?? createdAt;

    if (now - lastActivity > ONE_HOUR_MS) {
      this.lastActivityBySession.delete(sessionId);
      return false;
    }

    this.lastActivityBySession.set(sessionId, now);
    return true;
  }
}
