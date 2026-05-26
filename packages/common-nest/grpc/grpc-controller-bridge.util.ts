import { HttpStatus, Type } from '@nestjs/common';
import { buildSuccessResponse, GrpcBridgeBase } from '@plys/libraries/common-nest/grpc';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { GrpcBridgeHandler, IHttpResponse } from './grpc-http.types';

type ControllerMethod = (...args: never[]) => Promise<ITranslatedPayload<unknown>>;
type ControllerInstance = { [key: string]: ControllerMethod };

export function createControllerBridgeHandlers(
  bridge: GrpcBridgeBase,
  controllers: Array<{
    prefix: string;
    instance: object;
    methods: Record<
      string,
      (request: Parameters<GrpcBridgeBase['dispatch']>[0]) => Promise<unknown[]>
    >;
  }>,
): Record<string, GrpcBridgeHandler> {
  const handlers: Record<string, GrpcBridgeHandler> = {};

  for (const { prefix, instance, methods } of controllers) {
    const controller = instance as ControllerInstance;
    for (const [methodName, argBuilder] of Object.entries(methods)) {
      const operation = `${prefix}.${methodName}`;
      const controllerMethod = controller[methodName];
      handlers[operation] = async (request): Promise<IHttpResponse> => {
        const args = await argBuilder(request);
        const result = await controllerMethod(...(args as never[]));
        const payload = result as ITranslatedPayload<unknown>;
        const statusCode =
          payload.messageKey === 'success.created' ? HttpStatus.CREATED : HttpStatus.OK;
        return buildSuccessResponse(payload, statusCode);
      };
    }
  }

  return handlers;
}

export function controllerProvider<T>(controller: Type<T>): {
  provide: Type<T>;
  useClass: Type<T>;
} {
  return { provide: controller, useClass: controller };
}
