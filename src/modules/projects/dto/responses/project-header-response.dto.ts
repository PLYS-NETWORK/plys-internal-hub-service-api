import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IProjectHeaderOwner,
  IProjectHeaderPayment,
  IProjectHeaderResponse,
} from './interfaces/project-header.response.interface';

@Exclude()
export class ProjectHeaderOwnerDto implements IProjectHeaderOwner {
  @Expose()
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Acme Corp' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_initials', example: 'AC' })
  public readonly avatar_initials!: string;
}

@Exclude()
export class ProjectHeaderPaymentDto implements IProjectHeaderPayment {
  @Expose()
  @ApiProperty({ name: 'is_paid', example: true })
  public readonly is_paid!: boolean;

  @Expose()
  @ApiProperty({ name: 'amount', nullable: true, example: '70.00' })
  public readonly amount!: string | null;

  @Expose()
  @ApiProperty({ name: 'currency', nullable: true, example: 'USD' })
  public readonly currency!: string | null;

  @Expose()
  @ApiProperty({ name: 'paid_at', nullable: true, example: '2026-01-15T09:00:00Z' })
  public readonly paid_at!: Date | null;
}

@Exclude()
export class ProjectHeaderResponseDto implements IProjectHeaderResponse {
  @Expose()
  @ApiProperty({ name: 'project_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly project_id!: string;

  @Expose()
  @ApiProperty({ example: 'Project Alpha — UX Research Platform' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'TipTap JSON document; render with the same TipTap viewer used elsewhere.',
  })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.PUBLISHED })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'created_at', example: '2026-01-12T08:00:00Z' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true, example: '2026-01-15T09:30:00Z' })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'updated_at', example: '2026-04-27T07:15:00Z' })
  public readonly updated_at!: Date;

  @Expose()
  @ApiProperty({ type: ProjectHeaderOwnerDto })
  @Type(() => ProjectHeaderOwnerDto)
  public readonly owner!: ProjectHeaderOwnerDto;

  @Expose()
  @ApiProperty({ type: ProjectHeaderPaymentDto })
  @Type(() => ProjectHeaderPaymentDto)
  public readonly payment!: ProjectHeaderPaymentDto;
}
