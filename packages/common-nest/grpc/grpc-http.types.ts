/** Mirrors `common.v1.HttpRequest` from packages/proto. */
export interface IHttpRequest {
  operation?: string;
  body?: Buffer | Uint8Array;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/** Mirrors `common.v1.HttpResponse` from packages/proto. */
export interface IHttpResponse {
  statusCode?: number;
  body?: Buffer | Uint8Array;
  errorCode?: string;
  messageKey?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

/** Success payload returned inside HttpResponse.body by bridge handlers. */
export interface IGrpcBridgeSuccessPayload<T = unknown> {
  messageKey: string;
  args?: Record<string, string | number>;
  data: T;
}

/** Error payload returned inside HttpResponse.body by bridge handlers. */
export interface IGrpcBridgeErrorPayload {
  args?: Record<string, string | number>;
  details?: Record<string, unknown> | null;
}

export type GrpcBridgeHandler = (request: IHttpRequest) => Promise<IHttpResponse>;
