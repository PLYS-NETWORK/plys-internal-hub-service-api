import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApplicationStatus } from '@database/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class ListApplicationsDto extends PageOptionsDto {
  @Expose({ name: 'status' })
  @ApiPropertyOptional({ name: 'status', enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  public readonly status?: ApplicationStatus;
}
