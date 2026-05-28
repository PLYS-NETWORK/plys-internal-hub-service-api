import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SkillResponseDto } from '@plys/libraries/api-contracts/skills/dto/responses/skill-response.dto';
import { THROTTLE_PUBLIC_READ } from '@plys/libraries/common-nest/constants';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { SkillsService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Skills')
@ApiBearerAuth()
@Controller('platform/skills')
@Throttle(THROTTLE_PUBLIC_READ)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all skills (no pagination)' })
  public async getAll(): Promise<ITranslatedPayload<SkillResponseDto[]>> {
    const data = await this.skillsService.getAll();
    return { messageKey: 'success.ok', data };
  }
}
