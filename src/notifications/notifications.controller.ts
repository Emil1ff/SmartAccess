import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { unauthorized } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { ApiErrorResponses } from '../common/swagger/error-responses.decorator';
import { ApiSuccessResponse } from '../common/swagger/success-responses.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FindMyNotificationsQueryDto } from './dto/find-my-notifications-query.dto';
import { NotificationsService } from './notifications.service';

type JwtPayload = {
  sub: number;
};

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('recipients')
  @Permissions('notifications:add', 'users:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Recipient users',
    example: [{ id: 2, firstName: 'Ali', lastName: 'Mammadov', email: 'ali@mail.com' }],
  })
  findRecipients() {
    return this.notificationsService.findRecipients();
  }

  @Post()
  @Permissions('notifications:add')
  @ApiSuccessResponse({
    statusCode: 201,
    description: 'Notifications created for target users',
    example: [{ id: 1, title: 'Task', message: 'New update', userId: 2 }],
  })
  create(
    @Req() request: Request & { user?: JwtPayload },
    @Body() dto: CreateNotificationDto,
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.notificationsService.create(dto, request.user.sub);
  }

  @Get('me')
  @Permissions('notifications:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Current user notifications',
    example: {
      data: [{ id: 1, title: 'Task', message: 'Updated', userId: 2 }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  })
  findMine(
    @Req() request: Request & { user?: JwtPayload },
    @Query() query: FindMyNotificationsQueryDto,
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.notificationsService.findMine(request.user.sub, query);
  }

  @Patch(':id/read')
  @Permissions('notifications:view')
  @ApiSuccessResponse({
    statusCode: 200,
    description: 'Notification marked as read',
    example: { id: 1, readAt: '2026-04-01T12:00:00.000Z' },
  })
  @ApiErrorResponses(
    {
      statusCode: 404,
      errorCode: ERROR_CODES.NOTIFICATION_NOT_FOUND,
      message: 'Notification not found',
    },
  )
  markAsRead(
    @Req() request: Request & { user?: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!request.user?.sub) {
      throw unauthorized('Unauthorized', ERROR_CODES.UNAUTHORIZED);
    }

    return this.notificationsService.markAsRead(id, request.user.sub);
  }
}
