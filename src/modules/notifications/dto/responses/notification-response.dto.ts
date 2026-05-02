import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { INotificationResponse } from './interfaces/notification.response.interface';

@Exclude()
export class NotificationResponseDto implements INotificationResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'new_application' })
  public readonly type!: string;

  @Expose()
  @ApiProperty({ example: 'New application received' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({ example: 'Jane Doe applied to "Backend platform engineer"' })
  public readonly body!: string;

  @Expose()
  @ApiProperty({
    description:
      'Per-type metadata. Shape depends on `type` — see NotificationMetadataMap for the discriminated union.',
    additionalProperties: true,
  })
  public readonly metadata!: Record<string, unknown>;

  @Expose()
  @ApiProperty({ name: 'entity_type', example: 'application' })
  public readonly entity_type!: string;

  @Expose()
  @ApiProperty({ name: 'entity_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly entity_id!: string;

  @Expose()
  @ApiProperty({
    name: 'redirect_url',
    nullable: true,
    example: 'https://ployos.example/c/<businessId>/projects/<projectId>',
  })
  public readonly redirect_url!: string | null;

  @Expose()
  @ApiProperty({ name: 'is_read', example: false })
  public readonly is_read!: boolean;

  @Expose()
  @ApiProperty({ name: 'read_at', nullable: true })
  public readonly read_at!: string | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: string;

  @Expose()
  @ApiProperty({ name: 'actor_id', nullable: true })
  public readonly actor_id!: string | null;
}
