import { ApplicationStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IApplicationListItemConsultant,
  IApplicationListItemResponse,
} from './interfaces/application-list-item.response.interface';

@Exclude()
export class ApplicationListItemConsultantDto implements IApplicationListItemConsultant {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class ApplicationListItemResponseDto implements IApplicationListItemResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @Type(() => ApplicationListItemConsultantDto)
  @ApiProperty({ type: () => ApplicationListItemConsultantDto })
  public readonly consultant!: ApplicationListItemConsultantDto;

  @Expose()
  @ApiProperty({ name: 'cover_letter', nullable: true })
  public readonly cover_letter!: string | null;

  @Expose() @ApiProperty({ enum: ApplicationStatus }) public readonly status!: ApplicationStatus;
  @Expose() @ApiProperty({ name: 'applied_at' }) public readonly applied_at!: Date;
  @Expose()
  @ApiProperty({ name: 'reviewed_at', nullable: true })
  public readonly reviewed_at!: Date | null;

  @Expose()
  @ApiProperty({
    name: 'matching_rate',
    example: 75,
    description: '0–100, rounded. 0 when project has no required skills.',
  })
  public readonly matching_rate!: number;
}
