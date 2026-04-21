import { ProjectMemberStatus } from '@database/enums/project-member-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IProjectMemberAddressResponse,
  IProjectMemberResponse,
} from './interfaces/project-member.response.interface';

@Exclude()
export class ProjectMemberAddressResponseDto implements IProjectMemberAddressResponse {
  @Expose()
  @ApiProperty({ nullable: true, example: '123 Main St' })
  public readonly address_line!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'Istanbul' })
  public readonly city!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'Istanbul' })
  public readonly state_province!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '34000' })
  public readonly postal_code!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'TR' })
  public readonly country_code!: string | null;
}

@Exclude()
export class ProjectMemberResponseDto implements IProjectMemberResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly consultant_id!: string;

  @Expose()
  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.jpg' })
  public readonly avatar_url!: string | null;

  @Expose()
  @ApiProperty({ example: 'John Doe' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ enum: ProjectMemberStatus, example: ProjectMemberStatus.ACTIVE })
  public readonly status!: string;

  @Expose()
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  public readonly joined_at!: Date;

  @Expose()
  @ApiProperty({ type: ProjectMemberAddressResponseDto })
  @Type(() => ProjectMemberAddressResponseDto)
  public readonly address!: ProjectMemberAddressResponseDto;
}
