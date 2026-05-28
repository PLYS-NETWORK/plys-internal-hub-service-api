import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appWinstonLogger } from '@plys/libraries/common-nest/modules/logger/winston.config';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { GrpcGatewayHelper } from './grpc-gateway.helper';
import { IGrpcDispatchClient } from './grpc-http.client';
import { IHttpResponse } from './grpc-http.types';

describe('GrpcGatewayHelper', () => {
  class IdentityAuthClient {
    public readonly bridgeServiceName = 'Auth';
  }

  let helper: GrpcGatewayHelper;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const client = new IdentityAuthClient() as unknown as IGrpcDispatchClient;

  beforeEach(async () => {
    warnSpy = jest.spyOn(appWinstonLogger, 'warn').mockImplementation(() => appWinstonLogger);
    errorSpy = jest.spyOn(appWinstonLogger, 'error').mockImplementation(() => appWinstonLogger);

    const moduleRef = await Test.createTestingModule({
      providers: [
        GrpcGatewayHelper,
        {
          provide: RequestContextService,
          useValue: {
            requestId: 'req-123',
            userId: 'user-1',
            lang: 'en',
          },
        },
      ],
    }).compile();

    helper = moduleRef.get(GrpcGatewayHelper);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs upstream bridge errors with service and operation context', () => {
    const response: IHttpResponse = {
      statusCode: HttpStatus.BAD_GATEWAY,
      errorCode: 'EMAIL_DELIVERY_FAILED',
      messageKey: 'error.email.delivery_failed',
      body: Buffer.from(JSON.stringify({ details: { reason: 'provider_timeout' } })),
    };

    expect(() => helper.assertSuccess(client, 'adminAuth.requestOtp', response)).toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'upstream gRPC call failed | service: identity-service | operation: adminAuth.requestOtp',
        upstream_service: 'identity-service',
        upstream_client: 'IdentityAuthClient',
        upstream_grpc_service: 'Auth',
        grpc_operation: 'adminAuth.requestOtp',
        error_code: 'EMAIL_DELIVERY_FAILED',
        error_key: 'error.email.delivery_failed',
        error_details: { reason: 'provider_timeout' },
      }),
    );
  });

  it('logs transport failures as errors', async () => {
    const dispatchClient: IGrpcDispatchClient = {
      dispatch: () => {
        throw new Error('14 UNAVAILABLE: upstream disconnected');
      },
    };

    await expect(helper.callRaw(dispatchClient, { operation: 'auth.login' })).rejects.toThrow(
      '14 UNAVAILABLE: upstream disconnected',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('upstream gRPC transport failed'),
        grpc_operation: 'auth.login',
      }),
    );
  });
});
