import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AddSkillsDto } from './dto/requests/add-skills.dto';
import { RemoveSkillsDto } from './dto/requests/remove-skills.dto';
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a list of new skills (duplicates are skipped)' })
  public async addList(@Body() dto: AddSkillsDto): Promise<ITranslatedPayload<SkillResponseDto[]>> {
    const data = await this.skillsService.addList(dto);
    return { messageKey: 'success.created', data };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a list of skills by ID' })
  public async removeList(@Body() dto: RemoveSkillsDto): Promise<ITranslatedPayload<null>> {
    await this.skillsService.removeList(dto);
    return { messageKey: 'success.deleted', data: null };
  }
}
