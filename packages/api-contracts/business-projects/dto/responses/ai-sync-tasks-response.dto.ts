import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

export type AiSyncTaskOutcome = 'created' | 'updated' | 'deleted';

@Exclude()
export class AiSyncTaskResultDto {
  @Expose()
  @ApiProperty({ name: 'client_temp_id', nullable: true })
  public readonly client_temp_id!: string | null;

  @Expose()
  @ApiProperty({ enum: ['created', 'updated', 'deleted'] })
  public readonly status!: AiSyncTaskOutcome;

  @Expose()
  @ApiProperty({ name: 'task_id' })
  public readonly task_id!: string;
}

@Exclude()
export class AiSyncTasksResponseDto {
  @Expose()
  @Type(() => AiSyncTaskResultDto)
  @ApiProperty({ type: () => [AiSyncTaskResultDto] })
  public readonly results!: AiSyncTaskResultDto[];

  @Expose()
  @ApiProperty({
    name: 'project_status',
    enum: ProjectStatus,
    description: 'Auto-recomputed project status after the batch.',
  })
  public readonly project_status!: ProjectStatus;
}
