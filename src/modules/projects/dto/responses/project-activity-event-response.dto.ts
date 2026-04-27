import { ActivityEventType } from '@modules/unit-of-work/repositories';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IActivityActor,
  IProjectActivityEventResponse,
} from './interfaces/project-activity-event.response.interface';

@Exclude()
export class ActivityActorDto implements IActivityActor {
  @Expose()
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({ name: 'full_name', example: 'Nguyen Van A' })
  public readonly full_name!: string;
}

@Exclude()
export class ProjectActivityEventResponseDto implements IProjectActivityEventResponse {
  @Expose()
  @ApiProperty({ name: 'event_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly event_id!: string;

  @Expose()
  @ApiProperty({
    name: 'event_type',
    enum: [
      'task_status_changed',
      'application_received',
      'application_approved',
      'application_rejected',
      'member_joined',
    ],
  })
  public readonly event_type!: ActivityEventType;

  @Expose()
  @ApiProperty({ name: 'occurred_at', example: '2026-04-27T05:30:00Z' })
  public readonly occurred_at!: Date;

  @Expose()
  @ApiProperty({ type: ActivityActorDto, nullable: true })
  @Type(() => ActivityActorDto)
  public readonly actor!: ActivityActorDto | null;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Event-specific data — shape varies by `event_type`.',
  })
  public readonly payload!: Record<string, unknown>;
}
