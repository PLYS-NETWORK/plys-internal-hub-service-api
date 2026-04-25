import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SkillResponseDto } from './dto/responses/skill-response.dto';
import { SkillsService } from './skills.service';

@ApiTags('Skills')
@ApiBearerAuth()
@Controller('skills')
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
