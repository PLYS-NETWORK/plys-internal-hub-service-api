import { Metadata } from '@grpc/grpc-js';
import { UnreadCountResponseDto } from '@modules/notifications/dto/responses';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { assertGrpcSuccess } from '@plys/libraries/common-nest/grpc';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IdentitySessionClient } from '@plys/libraries/common-nest/modules/identity-client';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';
import type { Server, Socket } from 'socket.io';

import { NotificationsClient } from '@/clients/platform';

const REDIS_PATTERN = 'notif:user:*';
const REDIS_CHANNEL_PREFIX = 'notif:user:';
const ROOM_PREFIX = 'user:';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? ['*'];

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
  }
}

/**
 * Socket.IO gateway for live notification delivery. Runs on api-gateway (sole HTTP
 * entry) and fans out Redis pub/sub messages published by platform-service workers.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/ws/notifications',
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger: AppLogger;
  private subscribed = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly env: EnvironmentsService,
    private readonly redis: RedisService,
    private readonly identitySession: IdentitySessionClient,
    private readonly notificationsClient: NotificationsClient,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationsGateway.name, requestContext);
  }

  public async afterInit(server: Server): Promise<void> {
    this.server = server;
    if (this.subscribed) {
      return;
    }
    try {
      await this.redis.psubscribe(REDIS_PATTERN, (channel: string, message: string) => {
        this.handleRedisMessage(channel, message);
      });
      this.subscribed = true;
      this.logger.log(`afterInit — Redis subscribed | pattern: ${REDIS_PATTERN}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`afterInit — psubscribe failed | error: ${msg}`);
    }
  }

  public async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = await this.authenticate(client);
      if (!auth) {
        return;
      }
      client.data.auth = auth;
      await client.join(ROOM_PREFIX + auth.userId);

      const unread = await this.fetchUnreadCount(auth);
      client.emit('notification.connected', { unread_count: unread });
      this.logger.log(
        `handleConnection — connected | userId: ${auth.userId}, sessionId: ${auth.sessionId}, unread: ${unread}`,
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
    this.logger.log(
      `handleDisconnect | userId: ${userId ?? 'unauthenticated'}, socketId: ${client.id}`,
    );
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.subscribed) {
      try {
        await this.redis.punsubscribe(REDIS_PATTERN);
      } catch {
        // best-effort
      }
      this.subscribed = false;
    }
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

    const session = await this.identitySession.validateSession(
      payload.sessionId,
      handshakeDeviceId ?? payload.deviceId,
    );
    if (!session) {
      client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
      client.disconnect(true);
      return null;
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      activePlatform: payload.activePlatform,
      businessId: payload.businessId ?? session.businessId,
      email: payload.email,
      role: String(payload.role),
    };
  }

  private async fetchUnreadCount(auth: ISocketAuthPayload): Promise<number> {
    const metadata = this.buildAuthMetadata(auth);
    const response = await this.notificationsClient.dispatchOperation(
      'notifications.unreadCount',
      {},
      metadata,
    );
    const payload = assertGrpcSuccess<UnreadCountResponseDto>(response);
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

  private handleRedisMessage(channel: string, message: string): void {
    if (!channel.startsWith(REDIS_CHANNEL_PREFIX)) {
      return;
    }
    const userId = channel.slice(REDIS_CHANNEL_PREFIX.length);
    if (!userId) {
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`handleRedisMessage — invalid JSON | channel: ${channel} | error: ${msg}`);
      return;
    }
    this.server.to(ROOM_PREFIX + userId).emit('notification.new', payload);
  }
}
