export const REALTIME_CRUD_ENTITIES = [
  'users',
  'roles',
  'modules',
  'permissions',
  'notifications',
] as const;

export type RealtimeCrudEntity = (typeof REALTIME_CRUD_ENTITIES)[number];

export type RealtimeCrudAction = 'created' | 'updated' | 'deleted';

export function getRealtimeRoomForEntity(entity: RealtimeCrudEntity): string {
  return `crud:${entity}`;
}

export function getRealtimeEventForEntityAction(
  entity: RealtimeCrudEntity,
  action: RealtimeCrudAction,
): string {
  return `crud:${entity}:${action}`;
}

export function getRealtimeRoomForUser(userId: number): string {
  return `user:${userId}`;
}
