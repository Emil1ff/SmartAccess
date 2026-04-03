import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsRetentionService } from './audit-logs-retention.service';
import { AuditLogsService } from './audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsRetentionService],
})
export class AuditLogsModule {}
