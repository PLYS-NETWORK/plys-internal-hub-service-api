import { Metadata } from '@grpc/grpc-js';
import { InviteAdminEmailDto } from '@modules/admin-auth/dto/requests/invite-admin-email.dto';
import { ListAdminAllowedEmailsDto } from '@modules/admin-auth/dto/requests/list-admin-allowed-emails.dto';
import { SetBooleanFlagDto } from '@modules/admin-auth/dto/requests/set-boolean-flag.dto';
import { AdminAllowedEmailResponseDto } from '@modules/admin-auth/dto/responses/admin-allowed-email-response.dto';
import { AdminAllowedEmailsService } from '@modules/admin-auth/services/admin-allowed-emails.service';
import { Controller, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import {
  buildSuccessResponse,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class AdminAllowedEmailsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    (
      req: import('@plys/libraries/common-nest/grpc').IHttpRequest,
    ) => ReturnType<GrpcBridgeBase['dispatch']>
  > = {
    invite: (req) => this.invite(req),
    list: (req) => this.list(req),
    setActive: (req) => this.setActive(req),
  };

  constructor(
    requestContext: RequestContextService,
    private readonly adminAllowedEmailsService: AdminAllowedEmailsService,
  ) {
    super(requestContext);
  }

  @GrpcMethod('AdminAllowedEmails', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }

  private async invite(request: Parameters<GrpcBridgeBase['dispatch']>[0]): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<InviteAdminEmailDto>(request);
    const data = await this.adminAllowedEmailsService.invite(dto);
    return buildSuccessResponse(
      { messageKey: 'success.admin.allowed_email_invited', data },
      HttpStatus.CREATED,
    );
  }

  private async list(request: Parameters<GrpcBridgeBase['dispatch']>[0]): Promise<IHttpResponse> {
    const filters = this.parseJsonBody<ListAdminAllowedEmailsDto>(request);
    const data = await this.adminAllowedEmailsService.list(filters);
    return buildSuccessResponse<PageDto<AdminAllowedEmailResponseDto>>({
      messageKey: 'success.ok',
      data,
    });
  }

  private async setActive(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<SetBooleanFlagDto>(request);
    const id = this.getPathParam(request, 'id');
    await this.adminAllowedEmailsService.setActive(id, dto.value);
    return buildSuccessResponse({
      messageKey: 'success.admin.allowed_email_active_updated',
      data: null,
    });
  }
}
