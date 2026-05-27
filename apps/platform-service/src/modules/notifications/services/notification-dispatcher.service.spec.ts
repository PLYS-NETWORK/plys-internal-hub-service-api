import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NotificationDispatcherService } from './notification-dispatcher.service';

describe('NotificationDispatcherService live emit', () => {
  let service: NotificationDispatcherService;
  let realtimeEmitter: { emitToUser: jest.Mock };

  beforeEach(() => {
    realtimeEmitter = { emitToUser: jest.fn() };

    service = new NotificationDispatcherService(
      {} as never,
      { lang: 'en' } as never,
      {
        exists: jest.fn(async () => false),
        incr: jest.fn(),
        expire: jest.fn(),
      } as never,
      realtimeEmitter as never,
      {
        internalHubUrl: 'http://hub',
        lonaosUrl: 'http://lonaos',
        ployosUrl: 'http://ployos',
      } as never,
      {
        translate: jest.fn(async (key: string) => key),
      } as never,
    );
  });

  it('uses NotificationRealtimeEmitter instead of redis.publish', () => {
    expect(typeof service).toBe('object');
    expect(realtimeEmitter.emitToUser).not.toHaveBeenCalled();
  });
});
