import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors/app-exceptions';
import { ERROR_CODES } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FindMyNotificationsQueryDto } from './dto/find-my-notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async findRecipients() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateNotificationDto, actorUserId: number) {
    const uniqueUserIds = Array.from(new Set(dto.userIds));

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true },
    });

    const foundIds = new Set(users.map((item) => item.id));
    const missing = uniqueUserIds.find((id) => !foundIds.has(id));
    if (missing) {
      throw notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    const created = await this.prisma.$transaction(
      uniqueUserIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            type: dto.type,
            title: dto.title,
            message: dto.message,
            userId,
            createdById: actorUserId,
          },
        }),
      ),
    );

    for (const item of created) {
      this.realtimeService.emitCrudEvent('notifications', 'created', item);
      this.realtimeService.emitNotificationPush(item.userId, item);
    }

    return created;
  }

  async findMine(userId: number, query: FindMyNotificationsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.read === 'read' ? { readAt: { not: null } } : {}),
      ...(query.read === 'unread' ? { readAt: null } : {}),
    };

    const total = await this.prisma.notification.count({ where });

    const data = await this.prisma.notification.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 1 : Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(id: number, userId: number) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, readAt: true },
    });

    if (!existing) {
      throw notFound('Notification not found', ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        readAt: existing.readAt ?? new Date(),
      },
    });

    this.realtimeService.emitCrudEvent('notifications', 'updated', updated);
    this.realtimeService.emitNotificationPush(updated.userId, updated);
    return updated;
  }
}
