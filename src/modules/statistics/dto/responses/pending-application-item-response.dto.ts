import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IPendingApplicationItem } from './interfaces/pending-applications.response.interface';

@Exclude()
export class PendingApplicationItemResponseDto implements IPendingApplicationItem {
  @Expose()
  @ApiProperty({ name: 'application_id', example: 'app_001' })
  public readonly application_id!: string;

  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ name: 'project_name', example: 'Project Alpha' })
  public readonly project_name!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_id', example: 'usr_123' })
  public readonly consultant_id!: string;

  @Expose()
  @ApiProperty({ name: 'consultant_name', example: 'Nguyen Van A' })
  public readonly consultant_name!: string;

  @Expose()
  @ApiProperty({ name: 'applied_at', example: '2026-04-20T08:30:00Z' })
  public readonly applied_at!: Date;

  @Expose()
  @ApiProperty({ name: 'has_answered_questions', example: true })
  public readonly has_answered_questions!: boolean;
}
