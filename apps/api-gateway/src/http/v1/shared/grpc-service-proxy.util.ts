import { Provider, Type } from '@nestjs/common';
import { GrpcGatewayHelper, IGrpcDispatchClient } from '@plys/libraries/common-nest/grpc';

export type GrpcCallOptions = {
  body?: unknown;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
};

export type GrpcOperationArgBuilder = (args: unknown[]) => GrpcCallOptions;

/** Nest lifecycle / introspection keys must not become gRPC operation names. */
const PROXY_RESERVED_KEYS = new Set([
  'then',
  'catch',
  'finally',
  'constructor',
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'toString',
  'valueOf',
  'inspect',
  'nodeUtilInspectCustom',
]);

function collectServiceMethodNames(serviceToken: Type<object>): Set<string> {
  const names = new Set<string>();
  let proto: object | null = serviceToken.prototype;
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (typeof descriptor?.value === 'function') {
        names.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return names;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Buffer.isBuffer(value);
}

/** Default arg mapping: (dto) | (id) | (id, dto) | (id, taskId) | (id, taskId, dto). */
export function defaultGrpcArgsMapper(args: unknown[]): GrpcCallOptions {
  if (args.length === 0) {
    return {};
  }
  if (args.length === 1) {
    const [first] = args;
    if (isUuid(first)) {
      return { pathParams: { id: first } };
    }
    if (isPlainObject(first)) {
      return { body: first };
    }
    if (typeof first === 'string') {
      return { pathParams: { id: first } };
    }
    return { body: first };
  }
  if (args.length === 2) {
    const [first, second] = args;
    if (isUuid(first) && isPlainObject(second)) {
      return { pathParams: { id: first }, body: second };
    }
    if (isUuid(first) && isUuid(second)) {
      return { pathParams: { id: first, taskId: second } };
    }
    if (typeof first === 'string' && isPlainObject(second)) {
      return { pathParams: { id: first }, body: second };
    }
  }
  if (args.length === 3) {
    const [projectId, taskId, third] = args;
    const pathParams: Record<string, string> = {};
    if (typeof projectId === 'string') {
      pathParams.id = projectId;
    }
    if (typeof taskId === 'string') {
      pathParams.taskId = taskId;
    }
    if (isPlainObject(third)) {
      return { pathParams, body: third };
    }
    if (typeof third === 'string') {
      pathParams.attachmentId = third;
    }
    return { pathParams };
  }
  return { body: args[0] };
}

/**
 * Provides a service token whose methods forward to a gRPC dispatch client.
 * Operation names default to `{prefix}.{methodName}` unless overridden.
 */
export function provideGrpcServiceProxy<T extends object>(
  serviceToken: Type<T>,
  clientToken: Type<IGrpcDispatchClient>,
  prefix: string,
  methodOverrides: Partial<Record<keyof T & string, string | GrpcOperationArgBuilder>> = {},
): Provider {
  return {
    provide: serviceToken,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    useFactory: (client: IGrpcDispatchClient, grpcHelper: GrpcGatewayHelper) => {
      const methodNames = collectServiceMethodNames(serviceToken);

      return new Proxy({} as T, {
        get(
          _target,
          prop: string | symbol,
        ): undefined | ((...args: unknown[]) => Promise<unknown>) {
          if (typeof prop !== 'string' || PROXY_RESERVED_KEYS.has(prop)) {
            return undefined;
          }
          if (methodNames.size > 0 && !methodNames.has(prop)) {
            return undefined;
          }
          const override = methodOverrides[prop as keyof T & string];
          const operation = typeof override === 'string' ? override : `${prefix}.${prop}`;
          const argBuilder: GrpcOperationArgBuilder =
            typeof override === 'function' ? override : defaultGrpcArgsMapper;

          return async (...args: unknown[]) => {
            const options = argBuilder(args);
            const payload = await grpcHelper.call<unknown>(client, operation, options);
            return payload.data;
          };
        },
      });
    },
    inject: [clientToken, GrpcGatewayHelper],
  };
}
