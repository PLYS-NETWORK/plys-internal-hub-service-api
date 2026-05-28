import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListSkillExamsDto } from '@plys/libraries/api-contracts/admin-consultant-skill-exam/dto/requests/list-skill-exams.dto';
import { AdminSkillExamDetailResponseDto } from '@plys/libraries/api-contracts/admin-consultant-skill-exam/dto/responses/skill-exam-detail-response.dto';
import { AdminPaginatedSkillExamsResponseDto } from '@plys/libraries/api-contracts/admin-consultant-skill-exam/dto/responses/skill-exam-list-item-response.dto';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { AdminConsultantSkillExamService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Admin / Consultant Skill Exams')
@ApiBearerAuth()
@Controller('admin/skill-exams')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
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
