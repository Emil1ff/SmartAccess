import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import {
  getRealtimeEventForEntityAction,
  getRealtimeRoomForEntity,
  getRealtimeRoomForUser,
  REALTIME_CRUD_ENTITIES,
  type RealtimeCrudAction,
  type RealtimeCrudEntity,
} from './realtime.constants';

@Injectable()
export class RealtimeService {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  emitNotificationPush(userId: number, payload: unknown) {
    const safePayload = this.sanitizePayload(payload);
    const room = getRealtimeRoomForUser(userId);

    this.realtimeGateway.server.to(room).emit('notification:push', {
      payload: safePayload,
      timestamp: new Date().toISOString(),
    });
  }

  emitCrudEvent(entity: string, action: RealtimeCrudAction, payload: unknown) {
    if (!this.isSupportedEntity(entity)) {
      return;
    }

    const compactPayload = this.compactPayload(entity, payload);
    const safePayload = this.sanitizePayload(compactPayload);
    const room = getRealtimeRoomForEntity(entity);
    const actionEvent = getRealtimeEventForEntityAction(entity, action);
    const eventPayload = {
      entity,
      action,
      payload: safePayload,
      timestamp: new Date().toISOString(),
    };

    this.realtimeGateway.server.to(room).emit('crud:event', eventPayload);
    this.realtimeGateway.server.to(room).emit(actionEvent, eventPayload);
  }

  private isSupportedEntity(entity: string): entity is RealtimeCrudEntity {
    return (REALTIME_CRUD_ENTITIES as readonly string[]).includes(entity);
  }

  private compactPayload(entity: string, payload: unknown): unknown {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }

    const source = payload as Record<string, unknown>;

    const pick = (keys: string[]) => {
      const result: Record<string, unknown> = {};

      for (const key of keys) {
        if (key in source) {
          result[key] = source[key];
        }
      }

      return result;
    };

    if (entity === 'users') {
      return pick([
        'id',
        'firstName',
        'lastName',
        'email',
        'phoneNumber',
        'birthDate',
        'gender',
        'roleId',
        'createdAt',
        'updatedAt',
      ]);
    }

    if (entity === 'roles') {
      return pick(['id', 'name', 'isRoot', 'createdAt', 'updatedAt']);
    }

    if (entity === 'modules') {
      return pick(['id', 'name', 'createdAt', 'updatedAt']);
    }

    if (entity === 'permissions') {
      const result = pick(['id', 'moduleId', 'action', 'createdAt', 'updatedAt']);

      if (
        source.module &&
        typeof source.module === 'object' &&
        !Array.isArray(source.module)
      ) {
        const moduleSource = source.module as Record<string, unknown>;
        result.module = {
          ...(moduleSource.id !== undefined ? { id: moduleSource.id } : {}),
          ...(moduleSource.name !== undefined ? { name: moduleSource.name } : {}),
        };
      }

      return result;
    }

    if (entity === 'notifications') {
      return pick([
        'id',
        'type',
        'title',
        'message',
        'userId',
        'createdById',
        'readAt',
        'createdAt',
        'updatedAt',
      ]);
    }

    return source;
  }

  private sanitizePayload(payload: unknown): unknown {
    const sensitiveKeyRegex = /password|token|secret|authorization|cookie/i;

    const sanitize = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((item) => sanitize(item));
      }

      if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (sensitiveKeyRegex.test(key)) {
            result[key] = '***';
          } else {
            result[key] = sanitize(nestedValue);
          }
        }

        return result;
      }

      return value;
    };

    return sanitize(payload);
  }
}
