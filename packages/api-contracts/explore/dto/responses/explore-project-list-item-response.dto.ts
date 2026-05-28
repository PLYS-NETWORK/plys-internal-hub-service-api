import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IExploreProjectListItemResponse } from './interfaces/explore-project-list-item.response.interface';

@Exclude()
export class ExploreProjectListItemResponseDto implements IExploreProjectListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'AI-powered customer support automation' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Inc.' })
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({
    name: 'company_logo_url',
    nullable: true,
    example: 'https://cdn.example.com/logo.png',
  })
  public readonly company_logo_url!: string | null;

  @Expose()
  @ApiProperty({ name: 'is_partner_platform', example: false })
  public readonly is_partner_platform!: boolean;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 3 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({
    name: 'total_members',
    description: 'Active members currently on the project (ACTIVE status only).',
    example: 2,
  })
  public readonly total_members!: number;
}
