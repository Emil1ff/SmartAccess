import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { forbidden, unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

type JwtPayload = {
  sub: number;
  email: string;
  roleId: number;
  isRoot: boolean;
  permissions: string[];
};

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (root users only)' })
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Audit logs list with pagination',
    example: {
      data: [
        {
          id: 10,
          userId: 1,
          method: 'PATCH',
          path: '/users/2',
          action: 'PATCH /users/2',
          entity: 'users',
          entityId: 2,
          statusCode: 200,
          ip: '::1',
          userAgent: 'Mozilla/5.0',
          requestBody: { firstName: 'Ali' },
          errorMessage: null,
          createdAt: '2026-04-01T13:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    },
  })
  @ApiErrorResponses(
    { statusCode: 401, errorCode: ERROR_CODES.UNAUTHORIZED, message: 'Unauthorized' },
    {
      statusCode: 403,
      errorCode: ERROR_CODES.AUDIT_LOGS_VIEW_FORBIDDEN,
      message: 'Only root users can view audit logs',
    },
  )
  async findAll(
    @Req() request: Request & { user?: JwtPayload },
    @Query() query: AuditLogsQueryDto,
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    const userRole = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        role: {
          select: {
            isRoot: true,
          },
        },
      },
    });

    if (!userRole?.role?.isRoot) {
      throw forbidden(
        'Only root users can view audit logs',
        ERROR_CODES.AUDIT_LOGS_VIEW_FORBIDDEN,
      );
    }

    return this.auditLogsService.findAll(query);
  }
}
