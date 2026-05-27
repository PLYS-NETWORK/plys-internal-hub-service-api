import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockOf = jest.fn(() => ({ to: mockTo }));
const mockQuit = jest.fn(async () => 'OK');

jest.mock('@socket.io/redis-emitter', () => ({
  Emitter: jest.fn().mockImplementation(() => ({
    of: mockOf,
  })),
}));

jest.mock('./create-socket-io-redis-clients.util', () => ({
  createSocketIoRedisClient: jest.fn(() => ({ quit: mockQuit })),
}));

import {
  NOTIFICATION_EVENT_NEW,
  NOTIFICATION_WS_NAMESPACE,
} from './notification-realtime.constants';
import { NotificationRealtimeEmitterService } from './notification-realtime-emitter.service';

describe('NotificationRealtimeEmitterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emitToUser targets the notifications namespace and user room', () => {
    const env = {} as never;
    const service = new NotificationRealtimeEmitterService(env);
    const payload = { id: 'n-1', type: 'TEST' };

    service.emitToUser('user-123', payload);

    expect(mockOf).toHaveBeenCalledWith(NOTIFICATION_WS_NAMESPACE);
    expect(mockTo).toHaveBeenCalledWith('user:user-123');
    expect(mockEmit).toHaveBeenCalledWith(NOTIFICATION_EVENT_NEW, payload);
  });

  it('onModuleDestroy quits the dedicated redis client', async () => {
    const env = {} as never;
    const service = new NotificationRealtimeEmitterService(env);

    await service.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalled();
  });
});
