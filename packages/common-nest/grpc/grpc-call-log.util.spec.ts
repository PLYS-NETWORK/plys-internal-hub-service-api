import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';

import {
  buildExceptionLogMeta,
  buildInboundBridgeErrorMeta,
  buildUpstreamBridgeErrorMeta,
  resolveUpstreamServiceName,
} from './grpc-call-log.util';
import { IGrpcDispatchClient } from './grpc-http.client';
import { IHttpResponse } from './grpc-http.types';

describe('grpc-call-log.util', () => {
  class IdentityAuthClient {
    public readonly bridgeServiceName = 'Auth';
  }

  const client = new IdentityAuthClient() as unknown as IGrpcDispatchClient;

  it('maps identity client class to identity-service', () => {
    expect(resolveUpstreamServiceName(client)).toBe('identity-service');
  });

  it('builds structured bridge error metadata for outbound calls', () => {
    const response: IHttpResponse = {
      statusCode: HttpStatus.BAD_GATEWAY,
      errorCode: 'EMAIL_DELIVERY_FAILED',
      messageKey: 'error.email.delivery_failed',
      body: Buffer.from(JSON.stringify({ details: { provider: 'resend' } })),
    };

    expect(buildUpstreamBridgeErrorMeta(client, 'adminAuth.requestOtp', response)).toEqual(
      expect.objectContaining({
        upstream_service: 'identity-service',
        upstream_client: 'IdentityAuthClient',
        upstream_grpc_service: 'Auth',
        grpc_operation: 'adminAuth.requestOtp',
        upstream_status: HttpStatus.BAD_GATEWAY,
        error_code: 'EMAIL_DELIVERY_FAILED',
        error_key: 'error.email.delivery_failed',
        error_details: { provider: 'resend' },
      }),
    );
  });

  it('builds structured metadata for inbound bridge failures', () => {
    const exception = new TranslatableException({
      messageKey: 'error.email.delivery_failed',
      errorCode: ERROR_CODES.EMAIL_DELIVERY_FAILED,
      status: HttpStatus.BAD_GATEWAY,
      details: { reason: 'template_missing' },
    });
    const response: IHttpResponse = {
      statusCode: HttpStatus.BAD_GATEWAY,
      errorCode: ERROR_CODES.EMAIL_DELIVERY_FAILED,
      messageKey: 'error.email.delivery_failed',
      body: Buffer.from(JSON.stringify({ details: { reason: 'template_missing' } })),
    };

    expect(
      buildInboundBridgeErrorMeta(
        'AdminAuthGrpcController',
        'adminAuth.requestOtp',
        response,
        exception,
        'handler',
      ),
    ).toEqual(
      expect.objectContaining({
        bridge_controller: 'AdminAuthGrpcController',
        grpc_operation: 'adminAuth.requestOtp',
        handler_phase: 'handler',
        error_code: ERROR_CODES.EMAIL_DELIVERY_FAILED,
        error_key: 'error.email.delivery_failed',
        error_details: { reason: 'template_missing' },
        error_type: 'TranslatableException',
      }),
    );
  });

  it('extracts translatable exception fields', () => {
    const exception = new TranslatableException({
      messageKey: 'error.auth.invalid_credentials',
      errorCode: ERROR_CODES.GENERIC_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(buildExceptionLogMeta(exception)).toEqual(
      expect.objectContaining({
        error_type: 'TranslatableException',
        error_code: ERROR_CODES.GENERIC_UNAUTHORIZED,
        error_key: 'error.auth.invalid_credentials',
      }),
    );
  });
});
