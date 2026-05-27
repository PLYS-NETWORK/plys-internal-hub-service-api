import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';

@ApiTags('Gateway')
@Controller('gateway/health')
export class GatewayHealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'API gateway liveness (no upstream dependency checks)' })
  public getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'api-gateway' };
  }
}
