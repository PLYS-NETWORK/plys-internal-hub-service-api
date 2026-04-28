import { Public } from '@common/decorators/public.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDto } from './dto/responses/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
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
