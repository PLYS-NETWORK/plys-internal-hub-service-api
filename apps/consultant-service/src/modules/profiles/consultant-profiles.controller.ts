import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ConsultantProfilesService } from './consultant-profiles.service';
import { UpdateConsultantProfileDto } from './dto/requests';
import { ConsultantProfileResponseDto } from './dto/responses';
@Controller('consultant-profiles')
export class ConsultantProfilesController {
  constructor(private readonly consultantProfilesService: ConsultantProfilesService) {}
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get own consultant profile' })
  public async getProfile(): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.getProfile();
    return { messageKey: 'success.ok', data };
  }
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own consultant profile' })
  public async updateProfile(
    @Body() dto: UpdateConsultantProfileDto,
  ): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.updateProfile(dto);
    return { messageKey: 'success.consultant_profile.updated', data };
  }
}
