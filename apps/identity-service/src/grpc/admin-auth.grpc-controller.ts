import { Metadata } from '@grpc/grpc-js';
import { AdminRequestOtpDto, AdminVerifyOtpDto } from '@modules/admin-auth/dto/requests';
import { AdminAuthService } from '@modules/admin-auth/services/admin-auth.service';
import { AuthResponseDto } from '@modules/auth/dto/responses/auth-response.dto';
import { ISessionContext } from '@modules/auth/interfaces/auth-service.interface';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildSuccessResponse,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class AdminAuthGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    (
      req: import('@plys/libraries/common-nest/grpc').IHttpRequest,
    ) => ReturnType<GrpcBridgeBase['dispatch']>
  > = {
    requestOtp: (req) => this.requestOtp(req),
    verifyOtp: (req) => this.verifyOtp(req),
  };

  constructor(
    requestContext: RequestContextService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super(requestContext);
  }

  @GrpcMethod('AdminAuth', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }

  private async requestOtp(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = await this.parseAndValidateBody(request, AdminRequestOtpDto);
    const context = this.buildSessionContext(request);
    await this.adminAuthService.requestOtp(dto, context);
    return buildSuccessResponse({ messageKey: 'success.ok', data: null });
  }

  private async verifyOtp(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = await this.parseAndValidateBody(request, AdminVerifyOtpDto);
    const context = this.buildSessionContext(request);
    const data = await this.adminAuthService.verifyOtp(dto, context);
    return buildSuccessResponse<AuthResponseDto>({ messageKey: 'success.ok', data });
  }

  private buildSessionContext(request: Parameters<GrpcBridgeBase['dispatch']>[0]): ISessionContext {
    return {
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      deviceId: request.queryParams?.deviceId ?? this.requestContext.deviceId,
      fingerprint: request.queryParams?.fingerprint ?? null,
    };
  }
}
