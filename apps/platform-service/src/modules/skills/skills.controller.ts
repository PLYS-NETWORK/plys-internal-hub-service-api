import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PUBLIC_READ } from '@plys/libraries/common-nest/constants';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { SkillResponseDto } from './dto/responses/skill-response.dto';
import { SkillsService } from './skills.service';

@ApiTags('Skills')
@ApiBearerAuth()
@Controller('skills')
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
