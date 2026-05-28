import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { SkillResponseDto } from './dto/responses/skill-response.dto';
import { SkillsService } from './skills.service';
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
