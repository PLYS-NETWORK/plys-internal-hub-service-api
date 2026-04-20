import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApplyProjectDto } from './dto/requests';
import { ApplicationResponseDto } from './dto/responses';
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
}
