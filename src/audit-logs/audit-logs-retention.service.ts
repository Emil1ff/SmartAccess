import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsRetentionService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogsRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const shouldRunOnStartup = this.readBooleanEnv(
      'AUDIT_LOGS_CLEANUP_ON_STARTUP',
      true,
    );

    if (!shouldRunOnStartup) {
      return;
    }

    await this.cleanupOldLogs('startup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldLogs(reason: 'startup' | 'schedule' = 'schedule') {
    const retentionDays = this.readPositiveIntEnv('AUDIT_LOGS_RETENTION_DAYS', 90);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "AuditLog"
        WHERE "createdAt" < ${thresholdDate}
      `;

      this.logger.log(
        `Audit retention cleanup (${reason}) removed ${result} rows older than ${retentionDays} days`,
      );
    } catch (error) {
      if (this.isAuditLogTableMissing(error)) {
        this.logger.warn(
          'Skipping audit retention cleanup because "AuditLog" table does not exist yet. Run Prisma migrations.',
        );
        return;
      }

      this.logger.error(
        `Audit retention cleanup (${reason}) failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private isAuditLogTableMissing(error: unknown): boolean {
    const prismaError = error as {
      code?: string;
      meta?: {
        driverAdapterError?: {
          cause?: {
            kind?: string;
            table?: string;
          };
        };
      };
    };

    return (
      prismaError?.code === 'P2010' &&
      prismaError?.meta?.driverAdapterError?.cause?.kind === 'TableDoesNotExist' &&
      prismaError?.meta?.driverAdapterError?.cause?.table === 'AuditLog'
    );
  }

  private readBooleanEnv(key: string, fallback: boolean): boolean {
    const rawValue = process.env[key];

    if (rawValue === undefined) {
      return fallback;
    }

    return rawValue.toLowerCase() !== 'false';
  }

  private readPositiveIntEnv(key: string, fallback: number): number {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.floor(value);
  }
}
