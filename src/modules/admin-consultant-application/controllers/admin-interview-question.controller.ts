import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
import { CreateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/create-interview-question.dto';
import { UpdateInterviewQuestionDto } from '@modules/consultant-application/dto/requests/update-interview-question.dto';
import { InterviewQuestionBankResponseDto } from '@modules/consultant-application/dto/responses/interview-question-bank-response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InterviewQuestionBankService } from '../services/interview-question-bank.service';

@ApiTags('Admin — Interview Questions')
@ApiBearerAuth()
@Controller('admin/interview-questions')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
export class AdminInterviewQuestionController {
  constructor(private readonly questionBankService: InterviewQuestionBankService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List interview questions (filterable by type and isActive)' })
  public async list(
    @Query('type') type?: string,
    @Query('is_active') isActive?: string,
  ): Promise<ITranslatedPayload<InterviewQuestionBankResponseDto[]>> {
    const data = await this.questionBankService.list({
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    return { messageKey: 'success.ok', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a COMMUNICATION or SYSTEM_KNOWLEDGE question' })
  public async create(
    @Body() dto: CreateInterviewQuestionDto,
  ): Promise<ITranslatedPayload<InterviewQuestionBankResponseDto>> {
    const data = await this.questionBankService.create(dto);
    return { messageKey: 'success.interview_question.created', data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update question content and/or display order' })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewQuestionDto,
  ): Promise<ITranslatedPayload<InterviewQuestionBankResponseDto>> {
    const data = await this.questionBankService.update(id, dto);
    return { messageKey: 'success.interview_question.updated', data };
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle the active status of a question' })
  public async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<InterviewQuestionBankResponseDto>> {
    const data = await this.questionBankService.toggleActive(id);
    return { messageKey: 'success.interview_question.updated', data };
  }
}
