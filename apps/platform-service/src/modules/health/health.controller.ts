import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { HealthResponseDto } from './dto/responses/health-response.dto';
import { HealthService } from './health.service';
@Controller('health')
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
