import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApplyProjectDto, ListMyApplicationsDto } from './dto/requests';
import { ApplicationResponseDto, ConsultantApplicationListItemResponseDto } from './dto/responses';
import { ConsultantApplicationService } from './services/consultant-application.service';

@ApiTags('Applications - Consultant')
@ApiBearerAuth()
@Controller('applications-consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantApplicationController {
  constructor(private readonly consultantApplicationService: ConsultantApplicationService) {}

  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply to a project as a consultant' })
  public async apply(
    @Body() dto: ApplyProjectDto,
  ): Promise<ITranslatedPayload<ApplicationResponseDto>> {
    const data = await this.consultantApplicationService.applyToProject(dto);
    return { messageKey: 'success.application.created', data };
  }

  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my applications' })
  public async listMyApplications(
    @Query() dto: ListMyApplicationsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantApplicationListItemResponseDto>>> {
    const data = await this.consultantApplicationService.listMyApplications(dto);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw a pending application' })
  public async withdrawApplication(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<ApplicationResponseDto>> {
    const data = await this.consultantApplicationService.withdrawApplication(id);
    return { messageKey: 'success.application.withdrawn', data };
  }
}
