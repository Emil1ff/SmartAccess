import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

type AuditLogRow = {
  id: number;
  userId: number | null;
  method: string;
  path: string;
  action: string;
  entity: string | null;
  entityId: number | null;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  requestBody: unknown;
  errorMessage: string | null;
  createdAt: Date;
};

@Injectable()
export class AuditLogsService implements OnModuleInit {
  private defaultLimit = 20;
  private maxLimit = 100;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.defaultLimit = this.readPositiveIntEnv('AUDIT_LOGS_DEFAULT_LIMIT', 20);
    this.maxLimit = this.readPositiveIntEnv('AUDIT_LOGS_MAX_LIMIT', 100);
  }

  async findAll(query: AuditLogsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const requestedLimit =
      query.limit && query.limit > 0 ? query.limit : this.defaultLimit;
    const limit = Math.min(requestedLimit, this.maxLimit);
    const offset = (page - 1) * limit;

    const userId = query.userId ?? null;
    const method = query.method?.trim() ? query.method.trim() : null;
    const statusCode = query.statusCode ?? null;
    const entity = query.entity?.trim() ? query.entity.trim() : null;
    const path = query.path?.trim() ? `%${query.path.trim()}%` : null;
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const data = await this.prisma.$queryRaw<AuditLogRow[]>`
      SELECT
        "id",
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
      FROM "AuditLog"
      WHERE (${userId}::int IS NULL OR "userId" = ${userId}::int)
        AND (${method}::text IS NULL OR LOWER("method") = LOWER(${method}::text))
        AND (${statusCode}::int IS NULL OR "statusCode" = ${statusCode}::int)
        AND (${entity}::text IS NULL OR LOWER(COALESCE("entity", '')) = LOWER(${entity}::text))
        AND (${path}::text IS NULL OR "path" ILIKE ${path}::text)
        AND (${from}::timestamp IS NULL OR "createdAt" >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR "createdAt" <= ${to}::timestamp)
      ORDER BY "id" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM "AuditLog"
      WHERE (${userId}::int IS NULL OR "userId" = ${userId}::int)
        AND (${method}::text IS NULL OR LOWER("method") = LOWER(${method}::text))
        AND (${statusCode}::int IS NULL OR "statusCode" = ${statusCode}::int)
        AND (${entity}::text IS NULL OR LOWER(COALESCE("entity", '')) = LOWER(${entity}::text))
        AND (${path}::text IS NULL OR "path" ILIKE ${path}::text)
        AND (${from}::timestamp IS NULL OR "createdAt" >= ${from}::timestamp)
        AND (${to}::timestamp IS NULL OR "createdAt" <= ${to}::timestamp)
    `;

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private readPositiveIntEnv(key: string, fallback: number): number {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.floor(value);
  }
}
