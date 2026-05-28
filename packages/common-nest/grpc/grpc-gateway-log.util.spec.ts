import { HttpStatus } from '@nestjs/common';

import { buildUpstreamBridgeErrorMeta, resolveUpstreamServiceName } from './grpc-call-log.util';
import { IGrpcDispatchClient } from './grpc-http.client';
import { IHttpResponse } from './grpc-http.types';

describe('grpc-gateway-log.util', () => {
  class IdentityAuthClient {
    public readonly bridgeServiceName = 'Auth';
  }

  const client = new IdentityAuthClient() as unknown as IGrpcDispatchClient;

  it('maps identity client class to identity-service', () => {
    expect(resolveUpstreamServiceName(client)).toBe('identity-service');
  });

  it('builds structured bridge error metadata', () => {
    const response: IHttpResponse = {
      statusCode: HttpStatus.BAD_GATEWAY,
      errorCode: 'EMAIL_DELIVERY_FAILED',
      messageKey: 'error.email.delivery_failed',
      body: Buffer.from(JSON.stringify({ details: { provider: 'resend' } })),
    };

    expect(buildUpstreamBridgeErrorMeta(client, 'adminAuth.requestOtp', response)).toEqual({
      upstream_service: 'identity-service',
      upstream_client: 'IdentityAuthClient',
      upstream_grpc_service: 'Auth',
      grpc_operation: 'adminAuth.requestOtp',
      upstream_status: HttpStatus.BAD_GATEWAY,
      error_code: 'EMAIL_DELIVERY_FAILED',
      error_key: 'error.email.delivery_failed',
      error_details: { provider: 'resend' },
      error_args: undefined,
    });
  });
});
