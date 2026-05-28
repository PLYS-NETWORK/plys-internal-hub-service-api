import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { NOTIFICATION_EVENT_CONNECTED } from '@plys/libraries/common-nest/modules/notifications-realtime';
import type { Socket } from 'socket.io';

import { ERROR_CODES } from '../../../errors/error-codes';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtVerify: jest.Mock;
  let env: {
    jwtStrictClaims: boolean;
    jwtAccessSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
    allowedOrigins: string[];
    corsAllowLocalhost: boolean;
    wsConnectRateLimitPerMinute: number;
    wsMaxConnectionsPerUser: number;
  };
  let redis: {
    incr: jest.Mock<() => Promise<number>>;
    expire: jest.Mock;
    get: jest.Mock<(key: string) => Promise<string | null>>;
    set: jest.Mock;
  };
  let identitySession: { validateSession: jest.Mock };
  let notificationsClient: { dispatchOperation: jest.Mock };
  let grpcHelper: { assertSuccess: jest.Mock };
  let requestContext: Record<string, never>;
  let client: {
    id: string;
    data: Record<string, unknown>;
    handshake: {
      auth: Record<string, unknown>;
      headers: Record<string, string | undefined>;
      address: string;
    };
    join: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
    nsp: { in: jest.Mock };
  };

  beforeEach(() => {
    jwtVerify = jest.fn();
    env = {
      jwtStrictClaims: false,
      jwtAccessSecret: 'secret',
      jwtIssuer: 'issuer',
      jwtAudience: 'audience',
      allowedOrigins: ['http://localhost:3000'],
      corsAllowLocalhost: false,
      wsConnectRateLimitPerMinute: 30,
      wsMaxConnectionsPerUser: 10,
    };
    redis = {
      incr: jest.fn(async () => 1),
      expire: jest.fn(async () => undefined),
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
    };
    identitySession = {
      validateSession: jest.fn(async () => ({ businessId: null })),
    };
    notificationsClient = {
      dispatchOperation: jest.fn(async () => ({
        statusCode: 200,
        body: Buffer.from(JSON.stringify({ messageKey: 'success.ok', data: { unread_count: 2 } })),
      })),
    };
    grpcHelper = {
      assertSuccess: jest.fn((_client, _operation, response) =>
        JSON.parse((response.body as Buffer).toString('utf8')),
      ),
    };
    requestContext = {};

    gateway = new NotificationsGateway(
      { verify: jwtVerify } as unknown as JwtService,
      env as never,
      redis as never,
      identitySession as never,
      notificationsClient as never,
      grpcHelper as never,
      requestContext as never,
    );

    client = {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
        address: '127.0.0.1',
      },
      join: jest.fn(async () => undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
      nsp: {
        in: jest.fn(() => ({
          fetchSockets: jest.fn(async () => []),
        })),
      },
    };

    jwtVerify.mockReturnValue({
      sub: 'user-1',
      sessionId: 'session-1',
      activePlatform: 'BUSINESS',
      email: 'user@example.com',
      role: 'USER',
    });
  });

  it('rejects connections when the IP connect rate limit is exceeded', async () => {
    redis.incr.mockResolvedValue(31);

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.emit).toHaveBeenCalledWith('error', {
      code: ERROR_CODES.WS_CONNECT_RATE_LIMITED,
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(identitySession.validateSession).not.toHaveBeenCalled();
  });

  it('skips identity session validation when the session cache is warm', async () => {
    redis.get.mockImplementation(async (key: string) =>
      key.startsWith('ws:session:valid:') ? '1' : null,
    );

    await gateway.handleConnection(client as unknown as Socket);

    expect(identitySession.validateSession).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.emit).toHaveBeenCalledWith(NOTIFICATION_EVENT_CONNECTED, { unread_count: 2 });
  });

  it('uses the Redis unread-count cache before calling gRPC', async () => {
    redis.get.mockImplementation(async (key: string) => {
      if (key.startsWith('ws:session:valid:')) return '1';
      if (key === 'notif:unread:user-1') return '7';
      return null;
    });

    await gateway.handleConnection(client as unknown as Socket);

    expect(notificationsClient.dispatchOperation).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(NOTIFICATION_EVENT_CONNECTED, { unread_count: 7 });
  });
});
