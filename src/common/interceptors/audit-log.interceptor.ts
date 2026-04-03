import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

type JwtPayload = {
  sub: number;
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const response = context.switchToHttp().getResponse<Response>();

    const path = request.originalUrl ?? request.url;
    const method = request.method;

    if (!this.shouldAudit(method, path)) {
      return next.handle();
    }

    const action = `${method} ${path}`;
    const actorUserId = request.user?.sub ?? null;
    const entity = this.extractEntity(path);
    const entityId = this.extractEntityId(request.params?.id);
    const ip = request.ip ?? null;
    const userAgent = request.headers['user-agent'] ?? null;
    const requestBody = this.sanitizeRequestBody(request.body);

    return next.handle().pipe(
      tap(() => {
        void this.insertLog({
          userId: actorUserId,
          method,
          path,
          action,
          entity,
          entityId,
          statusCode: response.statusCode,
          ip,
          userAgent,
          requestBody,
          errorMessage: null,
        });
      }),
      catchError((error: unknown) => {
        const errorMessage =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Unhandled error';

        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof (error as { status?: unknown }).status === 'number'
            ? (error as { status: number }).status
            : response.statusCode || 500;

        void this.insertLog({
          userId: actorUserId,
          method,
          path,
          action,
          entity,
          entityId,
          statusCode,
          ip,
          userAgent,
          requestBody,
          errorMessage,
        });

        return throwError(() => error);
      }),
    );
  }

  private shouldAudit(method: string, path: string): boolean {
    const cleanedPath = path.split('?')[0] ?? path;
    const normalizedPath = cleanedPath.toLowerCase();
    const normalizedMethod = method.toUpperCase();

    const isAuthLoginOrLogout =
      normalizedMethod === 'POST' &&
      (normalizedPath === '/auth/login' || normalizedPath === '/auth/logout');

    if (isAuthLoginOrLogout) {
      return true;
    }

    return (
      normalizedMethod === 'PATCH' ||
      normalizedMethod === 'PUT' ||
      normalizedMethod === 'DELETE'
    );
  }

  private extractEntity(path: string): string | null {
    const cleanedPath = path.split('?')[0] ?? path;
    const segments = cleanedPath.split('/').filter(Boolean);

    return segments[0] ?? null;
  }

  private extractEntityId(rawId: string | string[] | undefined): number | null {
    if (!rawId) {
      return null;
    }

    const idValue = Array.isArray(rawId) ? rawId[0] : rawId;

    const parsed = Number(idValue);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private sanitizeRequestBody(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }

    const sensitiveKeyRegex = /password|token|secret|authorization|cookie|email|phone/i;

    const sanitizeValue = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
      }

      if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (sensitiveKeyRegex.test(key)) {
            result[key] = '***';
          } else {
            result[key] = sanitizeValue(nestedValue);
          }
        }

        return result;
      }

      return value;
    };

    return sanitizeValue(body) as Record<string, unknown>;
  }

  private async insertLog(log: {
    userId: number | null;
    method: string;
    path: string;
    action: string;
    entity: string | null;
    entityId: number | null;
    statusCode: number;
    ip: string | null;
    userAgent: string | null;
    requestBody: Record<string, unknown> | null;
    errorMessage: string | null;
  }) {
    const requestBodyJson = log.requestBody
      ? JSON.stringify(log.requestBody)
      : null;

    try {
      await this.prisma.$executeRaw`
        INSERT INTO "AuditLog" (
          "userId",
          "method",
          "path",
          "action",
          "entity",
          "entityId",
          "statusCode",
          "ip",
          "userAgent",
          "requestBody",
          "errorMessage",
          "createdAt"
        ) VALUES (
          ${log.userId},
          ${log.method},
          ${log.path},
          ${log.action},
          ${log.entity},
          ${log.entityId},
          ${log.statusCode},
          ${log.ip},
          ${log.userAgent},
          ${requestBodyJson}::jsonb,
          ${log.errorMessage},
          NOW()
        )
      `;
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log for ${log.method} ${log.path}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      // Audit logging should never break the main request pipeline.
    }
  }
}
