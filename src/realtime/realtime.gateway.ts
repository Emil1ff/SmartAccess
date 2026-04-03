import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  getRealtimeRoomForEntity,
  getRealtimeRoomForUser,
  REALTIME_CRUD_ENTITIES,
} from './realtime.constants';

type RealtimeJwtPayload = {
  sub: number;
  email: string;
  roleId: number;
  isRoot: boolean;
  permissions: string[];
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:5173',
      'http://localhost:4173',
    ],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(@ConnectedSocket() client: Socket) {
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn(`Realtime connection rejected (no token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<RealtimeJwtPayload>(token);

      client.data.user = payload;
      this.bindRooms(client, payload);
      this.logger.log(`Client connected: ${client.id}, userId: ${payload.sub}`);
    } catch {
      this.logger.warn(`Realtime connection rejected (invalid token): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return this.normalizeToken(authToken);
    }

    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return this.normalizeToken(headerToken);
    }

    return null;
  }

  private normalizeToken(rawToken: string): string {
    const token = rawToken.trim();

    if (token.toLowerCase().startsWith('bearer ')) {
      return token.slice(7).trim();
    }

    return token;
  }

  private bindRooms(client: Socket, payload: RealtimeJwtPayload) {
    client.join(getRealtimeRoomForUser(payload.sub));

    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];

    for (const entity of REALTIME_CRUD_ENTITIES) {
      if (payload.isRoot || this.hasEntityPermission(permissions, entity)) {
        client.join(getRealtimeRoomForEntity(entity));
      }
    }
  }

  private hasEntityPermission(permissions: string[], entity: string): boolean {
    const prefix = `${entity}:`;
    return permissions.some((permission) => permission.startsWith(prefix));
  }
}
