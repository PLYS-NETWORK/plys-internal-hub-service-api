import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it } from '@jest/globals';
import { assertGrpcServiceAuthorized } from '@plys/libraries/common-nest/grpc/grpc-service-auth.util';
import { GRPC_METADATA_KEYS } from '@plys/libraries/proto';

describe('assertGrpcServiceAuthorized', () => {
  it('allows local calls when GRPC_SERVICE_SECRET is unset', () => {
    const originalDeploy = process.env.DEPLOY_ENV;
    const originalSecret = process.env.GRPC_SERVICE_SECRET;
    process.env.DEPLOY_ENV = 'local';
    delete process.env.GRPC_SERVICE_SECRET;

    expect(() => assertGrpcServiceAuthorized(undefined)).not.toThrow();

    process.env.DEPLOY_ENV = originalDeploy;
    if (originalSecret !== undefined) {
      process.env.GRPC_SERVICE_SECRET = originalSecret;
    }
  });

  it('rejects calls with a mismatched secret in dev', () => {
    const originalDeploy = process.env.DEPLOY_ENV;
    const originalSecret = process.env.GRPC_SERVICE_SECRET;
    process.env.DEPLOY_ENV = 'dev';
    process.env.GRPC_SERVICE_SECRET = 'expected-secret-value-32chars-min';

    const metadata = new Metadata();
    metadata.set(GRPC_METADATA_KEYS.SERVICE_AUTH, 'wrong-secret');

    expect(() => assertGrpcServiceAuthorized(metadata)).toThrow();

    process.env.DEPLOY_ENV = originalDeploy;
    if (originalSecret !== undefined) {
      process.env.GRPC_SERVICE_SECRET = originalSecret;
    } else {
      delete process.env.GRPC_SERVICE_SECRET;
    }
  });
});
