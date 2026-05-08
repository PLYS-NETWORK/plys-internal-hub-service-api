import { HEADERS } from '@common/constants';
import { Public } from '@common/decorators/public.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { AuthResponseDto } from '@modules/auth/dto/responses/auth-response.dto';
import { ISessionContext } from '@modules/auth/interfaces/auth-service.interface';
import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminRequestOtpDto, AdminVerifyOtpDto } from './dto/requests';
import { AdminAuthService } from './services/admin-auth.service';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request an admin OTP',
    description:
      'Always returns 200 regardless of whether the email is whitelisted — prevents enumeration.',
  })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier',
  })
  @ApiHeader({ name: HEADERS.X_FINGERPRINT, required: false, description: 'Client fingerprint' })
  public async requestOtp(
    @Body() dto: AdminRequestOtpDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<null>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    await this.adminAuthService.requestOtp(dto, context);
    return { messageKey: 'success.ok', data: null };
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
  public async verifyOtp(
    @Body() dto: AdminVerifyOtpDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.adminAuthService.verifyOtp(dto, context);
    return { messageKey: 'success.ok', data };
  }

  private buildSessionContext(deviceId?: string, fingerprint?: string): ISessionContext {
    return {
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      deviceId: deviceId ?? null,
      fingerprint: fingerprint ?? null,
    };
  }
}
