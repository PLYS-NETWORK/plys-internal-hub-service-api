import { AdminRequestOtpDto, AdminVerifyOtpDto } from '@modules/admin-auth/dto/requests';
import { AuthResponseDto } from '@modules/auth/dto/responses/auth-response.dto';
import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HEADERS, THROTTLE_OTP } from '@plys/libraries/common-nest/constants';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { IdentityAdminAuthClient } from '@/clients/identity';
import { sessionQueryParams } from '@/http/shared/session-query.util';

@ApiTags('Admin Auth')
@Controller('admin/auth')
@Throttle(THROTTLE_OTP)
export class AdminAuthController {
  constructor(
    private readonly adminAuthClient: IdentityAdminAuthClient,
    private readonly grpcHelper: GrpcGatewayHelper,
  ) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request an admin OTP',
    description:
      'Returns 403 (ADMIN_AUTH_EMAIL_NOT_ALLOWED) if the email is not on the active admin whitelist.',
  })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier',
  })
  @ApiHeader({ name: HEADERS.X_FINGERPRINT, required: false, description: 'Client fingerprint' })
  public requestOtp(
    @Body() dto: AdminRequestOtpDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.adminAuthClient, 'requestOtp', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify admin OTP and receive session tokens' })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: true,
    description: 'Unique device identifier (required for admin login)',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: true,
    description: 'Client fingerprint (required for admin login)',
  })
  public verifyOtp(
    @Body() dto: AdminVerifyOtpDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.adminAuthClient, 'verifyOtp', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }
}
