import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HealthResponseDto } from '@plys/libraries/api-contracts/health/dto/responses/health-response.dto';
import { THROTTLE_PUBLIC_READ } from '@plys/libraries/common-nest/constants';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { HealthService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Health')
@Controller('platform/health')
@Throttle(THROTTLE_PUBLIC_READ)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API, database, and Redis connectivity' })
  public async check(): Promise<ITranslatedPayload<HealthResponseDto>> {
    const data = await this.healthService.check();
    return { messageKey: 'success.ok', data };
  }
}
