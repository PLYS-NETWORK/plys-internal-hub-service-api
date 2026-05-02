import { ERROR_CODES } from '@common/constants/error-codes';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

const REDIS_PATTERN = 'notif:user:*';
const REDIS_CHANNEL_PREFIX = 'notif:user:';
const ROOM_PREFIX = 'user:';

// Decorators run at class-load time, so we can't pull from EnvironmentsService here.
// Read the same env var that EnvironmentsService.allowedOrigins reads — keeps the
// HTTP CORS list (set in main.ts) and the WS handshake CORS list in lockstep.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? ['*'];

interface ISocketAuthPayload {
  userId: string;
  sessionId: string;
  activePlatform: ActivePlatform;
  businessId: string | null;
}

// Augment Socket.IO's `SocketData` slot with our auth payload. Using module
// augmentation on `SocketData` (the typed user-data slot) instead of `Socket`
// directly so we don't collide with socket.io's internal property typing.
declare module 'socket.io' {
  interface SocketData {
    auth?: ISocketAuthPayload;
  }
}

/**
 * Socket.IO gateway for live notification delivery to authenticated BUSINESS users.
 *
 * Auth: JWT verified inside handleConnection — we cannot rely on JwtAuthGuard
 * because gateways bypass the HTTP middleware/guard chain. The verification
 * mirrors JwtContextMiddleware (issuer/audience pinning, session existence,
 * device-binding when the client sent it).
 *
 * Fan-out: a single shared Redis psubscribe('notif:user:*') per process. On
 * each pmessage we extract userId from the channel and broadcast to the
 * room `user:{userId}` — empty rooms on this instance are cheap no-ops.
 *
 * Important: the global TransformResponseInterceptor does NOT run on WS
 * messages, and that is intentional. We emit raw `INotificationResponse`
 * payloads here so the FE socket.on('notification.new') handler receives the
 * exact discriminated-union object from `NotificationPayload`.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/ws/notifications',
  // CORS for the WS handshake is configured here, NOT inherited from
  // app.enableCors(). Origin list mirrors process.env.ALLOWED_ORIGINS.
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
    private readonly uow: UnitOfWorkService,
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
        // authenticate() already disconnected the client.
        return;
      }
      client.data.auth = auth;
      await client.join(ROOM_PREFIX + auth.userId);

      const unread = await this.uow.notifications.countUnreadByUserId(auth.userId);
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

  /**
   * Verifies the JWT carried on the handshake against the same rules
   * JwtContextMiddleware uses for HTTP. Returns null when authentication fails;
   * the caller treats null as "already disconnected" (we emit + disconnect inside).
   */
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

    // Device-binding (opt-in via handshake auth.deviceId).
    const handshakeDeviceId = this.coerceString(client.handshake.auth?.deviceId);
    if (payload.deviceId && handshakeDeviceId && payload.deviceId !== handshakeDeviceId) {
      client.emit('error', { code: ERROR_CODES.AUTH_DEVICE_MISMATCH });
      client.disconnect(true);
      return null;
    }

    // Session-existence: rejects logged-out, rotated, or expired sessions even
    // though their JWT may still be inside its TTL.
    const session = await this.uow.userSessions.findByActiveId(payload.sessionId);
    if (!session || session.usedAt !== null || session.expiresAt < new Date()) {
      client.emit('error', { code: ERROR_CODES.AUTH_TOKEN_INVALID });
      client.disconnect(true);
      return null;
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      activePlatform: payload.activePlatform,
      businessId: payload.businessId ?? null,
    };
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

  /**
   * Single fan-out point for every Redis pub/sub message. Empty rooms on
   * this instance are cheap no-ops — Socket.IO checks the room set in O(1).
   */
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
