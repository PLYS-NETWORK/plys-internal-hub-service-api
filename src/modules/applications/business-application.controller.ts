import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListProjectApplicationsDto, ReviewApplicationDto } from './dto/requests';
import { ApplicationResponseDto, BusinessApplicationListItemResponseDto } from './dto/responses';
import { BusinessApplicationService } from './services/business-application.service';

@ApiTags('Applications - Business')
@ApiBearerAuth()
@Controller('applications-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessApplicationController {
  constructor(private readonly businessApplicationService: BusinessApplicationService) {}

  @Get('projects/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List applications for a specific project' })
  public async listProjectApplications(
    @Param('projectId') projectId: string,
    @Query() dto: ListProjectApplicationsDto,
  ): Promise<ITranslatedPayload<PageDto<BusinessApplicationListItemResponseDto>>> {
    const data = await this.businessApplicationService.listProjectApplications(projectId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject an application' })
  public async reviewApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
  ): Promise<ITranslatedPayload<ApplicationResponseDto>> {
    const data = await this.businessApplicationService.reviewApplication(id, dto);
    const messageKey =
      dto.action === 'approve' ? 'success.application.approved' : 'success.application.rejected';
    return { messageKey, data };
  }
}
