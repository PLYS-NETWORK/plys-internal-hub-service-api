import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ListSkillExamsDto } from '../dto/requests/list-skill-exams.dto';
import { AdminSkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { AdminPaginatedSkillExamsResponseDto } from '../dto/responses/skill-exam-list-item-response.dto';
import { AdminConsultantSkillExamService } from '../services/admin-consultant-skill-exam.service';
@Controller('admin/skill-exams')
export class AdminConsultantSkillExamController {
  constructor(private readonly service: AdminConsultantSkillExamService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Paginated list of skill exams. Columns: consultant full name, skill name, rating, level, status.',
  })
  public async list(
    @Query() dto: ListSkillExamsDto,
  ): Promise<ITranslatedPayload<AdminPaginatedSkillExamsResponseDto>> {
    const data = await this.service.list(dto);
    return { messageKey: 'success.ok', data };
  }
  @Get(':examId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Skill exam detail — full 20 Q&As with per-answer CopyLeaks + AI eval scores + feedback.',
  })
  public async getDetail(
    @Param('examId', ParseUUIDPipe) examId: string,
  ): Promise<ITranslatedPayload<AdminSkillExamDetailResponseDto>> {
    const data = await this.service.getDetail(examId);
    return { messageKey: 'success.ok', data };
  }
}
