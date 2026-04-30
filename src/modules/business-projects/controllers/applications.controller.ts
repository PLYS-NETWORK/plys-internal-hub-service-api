import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ListApplicationsDto, RejectApplicationDto } from '../dto/requests';
import { ApplicationDetailResponseDto, ApplicationListItemResponseDto } from '../dto/responses';
import { ApplicationsService } from '../services/applications.service';

@ApiTags('Business Projects — Applications')
@ApiBearerAuth()
@Controller('projects/business/:id/applications')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List project applications with matching_rate' })
  public async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListApplicationsDto,
  ): Promise<ITranslatedPayload<PageDto<ApplicationListItemResponseDto>>> {
    const data = await this.applicationsService.list(id, dto);
    return { messageKey: 'success.ok', data };
  }

  @Get(':applicationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Application detail with consultant skills + interview answers' })
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<ITranslatedPayload<ApplicationDetailResponseDto>> {
    const data = await this.applicationsService.getDetail(id, applicationId);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':applicationId/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Approve a PENDING application' })
  public async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<void> {
    await this.applicationsService.approve(id, applicationId);
  }

  @Patch(':applicationId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject a PENDING application (optional reason)' })
  public async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: RejectApplicationDto,
  ): Promise<void> {
    await this.applicationsService.reject(id, applicationId, dto);
  }
}
