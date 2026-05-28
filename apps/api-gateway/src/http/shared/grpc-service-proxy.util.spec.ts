import { Injectable } from '@nestjs/common';
import { GrpcGatewayHelper, IGrpcDispatchClient } from '@plys/libraries/common-nest/grpc';

import { provideGrpcServiceProxy } from './grpc-service-proxy.util';

@Injectable()
class SampleProfilesService {
  public findAll(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

describe('provideGrpcServiceProxy', () => {
  it('forwards declared service methods to gRPC', async () => {
    const client = {} as IGrpcDispatchClient;
    const grpcHelper = {
      call: jest.fn().mockResolvedValue({ messageKey: 'success.ok', data: [{ id: '1' }] }),
    } as unknown as GrpcGatewayHelper;

    const provider = provideGrpcServiceProxy(SampleProfilesService, class {}, 'businessProfiles');
    const proxy = provider.useFactory!(client, grpcHelper) as SampleProfilesService;

    await expect(proxy.findAll()).resolves.toEqual([{ id: '1' }]);
    expect(grpcHelper.call).toHaveBeenCalledWith(client, 'businessProfiles.findAll', {});
  });

  it('does not treat Nest lifecycle hooks as gRPC operations', () => {
    const client = {} as IGrpcDispatchClient;
    const grpcHelper = { call: jest.fn() } as unknown as GrpcGatewayHelper;

    const provider = provideGrpcServiceProxy(SampleProfilesService, class {}, 'businessProfiles');
    const proxy = provider.useFactory!(client, grpcHelper) as Record<string, unknown>;

    expect(proxy.onModuleInit).toBeUndefined();
    expect(proxy.onApplicationBootstrap).toBeUndefined();
    expect(grpcHelper.call).not.toHaveBeenCalled();
  });
});
