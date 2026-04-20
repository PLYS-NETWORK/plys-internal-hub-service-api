import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantSummary } from './interfaces';

@Exclude()
export class ConsultantSummaryDto implements IConsultantSummary {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({
    name: 'avatar_url',
    example: 'https://cdn.example.com/avatar.jpg',
    nullable: true,
  })
  public readonly avatar_url!: string | null;
}
