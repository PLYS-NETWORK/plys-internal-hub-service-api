import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UnreadCountResponseDto } from '@plys/libraries/api-contracts/notifications/dto/responses';
import { GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IdentitySessionClient } from '@plys/libraries/common-nest/modules/identity-client';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import {
  NOTIFICATION_EVENT_CONNECTED,
  NOTIFICATION_UNREAD_COUNT_KEY_PREFIX,
  NOTIFICATION_WS_NAMESPACE,
  notificationRoomForUser,
  WS_CONNECT_RATE_KEY_PREFIX,
  WS_CONNECT_RATE_WINDOW_SECONDS,
  WS_SESSION_VALID_KEY_PREFIX,
  WS_SESSION_VALID_TTL_SECONDS,
} from '@plys/libraries/common-nest/modules/notifications-realtime';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { createCorsOriginDelegate } from '@plys/libraries/common-nest/utils/cors-origin.util';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';
import type { Server, Socket } from 'socket.io';

import { NotificationsClient } from '@/clients/v1/notifications';

import { ERROR_CODES } from '../../../errors/error-codes';

interface ISocketAuthPayload {
  userId: string;
  sessionId: string;
  activePlatform: ActivePlatform;
  businessId: string | null;
  email: string;
  role: string;
}

declare module 'socket.io' {
  interface SocketData {
    auth?: ISocketAuthPayload;
    connectedAt?: number;
  }
}

/**
 * Socket.IO gateway for live notification delivery. Runs on api-gateway (sole HTTP
 * entry). Cross-instance fan-out uses `@socket.io/redis-adapter`; platform-service
 * emits via `@socket.io/redis-emitter`.
 */
@Injectable()
@WebSocketGateway({
  namespace: NOTIFICATION_WS_NAMESPACE,
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger: AppLogger;
  private activeConnections = 0;

  constructor(
    private readonly jwtService: JwtService,
    private readonly env: EnvironmentsService,
    private readonly redis: RedisService,
    private readonly identitySession: IdentitySessionClient,
    private readonly notificationsClient: NotificationsClient,
    private readonly grpcHelper: GrpcGatewayHelper,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationsGateway.name, requestContext);
  }

  public afterInit(server: Server): void {
    this.server = server;
    if (server.engine?.opts) {
      server.engine.opts.cors = {
        origin: createCorsOriginDelegate(this.env.allowedOrigins, this.env.corsAllowLocalhost),
        credentials: true,
      };
    }
    this.logger.log(`afterInit — WS ready | namespace: ${NOTIFICATION_WS_NAMESPACE}`);
  }

  public async handleConnection(client: Socket): Promise<void> {
    try {
      if (!(await this.checkConnectRateLimit(client))) {
        return;
      }

      const auth = await this.authenticate(client);
      if (!auth) {
        return;
      }

      await this.enforceUserConnectionCap(client, auth.userId);

      client.data.auth = auth;
      client.data.connectedAt = Date.now();
      await client.join(notificationRoomForUser(auth.userId));

      const unread = await this.resolveUnreadCount(auth);
      client.emit(NOTIFICATION_EVENT_CONNECTED, { unread_count: unread });

      this.activeConnections += 1;
      this.logger.log(
        `handleConnection — connected | userId: ${auth.userId}, sessionId: ${auth.sessionId}, unread: ${unread}, active: ${this.activeConnections}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`handleConnection — failed | socketId: ${client.id} | error: ${msg}`);
      client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: Socket): void {
    const userId = client.data.auth?.userId;
    if (client.data.auth) {
      this.activeConnections = Math.max(0, this.activeConnections - 1);
    }
    this.logger.log(
      `handleDisconnect | userId: ${userId ?? 'unauthenticated'}, socketId: ${client.id}, active: ${this.activeConnections}`,
    );
  }

  private async checkConnectRateLimit(client: Socket): Promise<boolean> {
    const ip = this.resolveClientIp(client);
    const key = `${WS_CONNECT_RATE_KEY_PREFIX}${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, WS_CONNECT_RATE_WINDOW_SECONDS);
    }
    if (count > this.env.wsConnectRateLimitPerMinute) {
      this.logger.warn(`checkConnectRateLimit — rejected | ip: ${ip}, count: ${count}`);
      client.emit('error', { code: ERROR_CODES.WS_CONNECT_RATE_LIMITED });
      client.disconnect(true);
      return false;
    }
    return true;
  }

  private async enforceUserConnectionCap(client: Socket, userId: string): Promise<void> {
    const roomName = notificationRoomForUser(userId);
    const socketsInRoom = await client.nsp.in(roomName).fetchSockets();
    const max = this.env.wsMaxConnectionsPerUser;
    if (socketsInRoom.length < max) {
      return;
    }

    let oldest = socketsInRoom[0];
    for (const socket of socketsInRoom) {
      const socketData = socket.data as { connectedAt?: number };
      const oldestData = oldest.data as { connectedAt?: number };
      const connectedAt = socketData.connectedAt ?? 0;
      const oldestAt = oldestData.connectedAt ?? 0;
      if (connectedAt < oldestAt) {
        oldest = socket;
      }
    }

    oldest.emit('error', { code: ERROR_CODES.WS_MAX_CONNECTIONS_EXCEEDED });
    oldest.disconnect(true);
    this.logger.warn(
      `enforceUserConnectionCap — evicted oldest socket | userId: ${userId}, roomSize: ${socketsInRoom.length}, max: ${max}`,
    );
  }

  private async authenticate(client: Socket): Promise<ISocketAuthPayload | null> {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
      client.disconnect(true);
      return null;
    }

    let payload: JwtPayload;
    try {
      const strict = this.env.jwtStrictClaims;
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.env.jwtAccessSecret,
        algorithms: ['HS256'],
        issuer: strict ? this.env.jwtIssuer : undefined,
        audience: strict ? this.env.jwtAudience : undefined,
      });
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : 'UnknownError';
      this.logger.warn(`authenticate — token rejected | socketId: ${client.id}, reason: ${name}`);
      client.emit('error', {
        code:
          name === 'TokenExpiredError'
            ? ERROR_CODES.AUTH_TOKEN_EXPIRED
            : ERROR_CODES.AUTH_TOKEN_INVALID,
      });
      client.disconnect(true);
      return null;
    }

    if (!payload.sessionId) {
      client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
      client.disconnect(true);
      return null;
    }

    const handshakeDeviceId = this.coerceString(client.handshake.auth?.deviceId);
    if (payload.deviceId && handshakeDeviceId && payload.deviceId !== handshakeDeviceId) {
      client.emit('error', { code: ERROR_CODES.AUTH_DEVICE_MISMATCH });
      client.disconnect(true);
      return null;
    }

    const sessionCacheKey = `${WS_SESSION_VALID_KEY_PREFIX}${payload.sessionId}`;
    const sessionCached = await this.redis.get(sessionCacheKey);

    let businessId = payload.businessId ?? null;
    if (!sessionCached) {
      const session = await this.identitySession.validateSession(
        payload.sessionId,
        handshakeDeviceId ?? payload.deviceId,
      );
      if (!session) {
        client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
        client.disconnect(true);
        return null;
      }
      businessId = payload.businessId ?? session.businessId;
      await this.redis.set(sessionCacheKey, '1', WS_SESSION_VALID_TTL_SECONDS);
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      activePlatform: payload.activePlatform,
      businessId,
      email: payload.email,
      role: String(payload.role),
    };
  }

  private async resolveUnreadCount(auth: ISocketAuthPayload): Promise<number> {
    const cacheKey = `${NOTIFICATION_UNREAD_COUNT_KEY_PREFIX}${auth.userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      const parsed = parseInt(cached, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return this.fetchUnreadCount(auth);
  }

  private async fetchUnreadCount(auth: ISocketAuthPayload): Promise<number> {
    const metadata = this.buildAuthMetadata(auth);
    const response = await this.notificationsClient.dispatchOperation(
      'notifications.unreadCount',
      {},
      metadata,
    );
    const payload = this.grpcHelper.assertSuccess<UnreadCountResponseDto>(
      this.notificationsClient,
      'notifications.unreadCount',
      response,
    );
    return payload.data?.unread_count ?? 0;
  }

  private buildAuthMetadata(auth: ISocketAuthPayload): Metadata {
    const metadata = new Metadata();
    metadata.set(GRPC_METADATA_KEYS.USER_ID, auth.userId);
    metadata.set(GRPC_METADATA_KEYS.USER_EMAIL, auth.email);
    metadata.set(GRPC_METADATA_KEYS.USER_ROLE, auth.role);
    metadata.set(GRPC_METADATA_KEYS.SESSION_ID, auth.sessionId);
    metadata.set(GRPC_METADATA_KEYS.ACTIVE_PLATFORM, String(auth.activePlatform));
    if (auth.businessId) {
      metadata.set(GRPC_METADATA_KEYS.BUSINESS_ID, auth.businessId);
    }
    return metadata;
  }

  private resolveClientIp(client: Socket): string {
    const forwarded = client.handshake.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? client.handshake.address;
    }
    return client.handshake.address;
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = this.coerceString(client.handshake.auth?.token);
    if (fromAuth) {
      return fromAuth.startsWith('Bearer ') ? fromAuth.slice(7) : fromAuth;
    }
    const headers = client.handshake.headers as Record<string, string | string[] | undefined>;
    const authHeader = headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  private coerceString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
