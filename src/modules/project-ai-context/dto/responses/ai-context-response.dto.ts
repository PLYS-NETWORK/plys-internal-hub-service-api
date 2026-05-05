import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IAiContextResponse } from './interfaces/ai-context.response.interface';

@Exclude()
export class AiContextResponseDto implements IAiContextResponse {
  @Expose() @ApiProperty({ name: 'project_id' }) public readonly project_id!: string;

  @Expose() @ApiProperty({ nullable: true }) public readonly domain!: string | null;

  @Expose()
  @ApiProperty({ name: 'primary_stack', type: [String], nullable: true })
  public readonly primary_stack!: string[] | null;

  @Expose() @ApiProperty({ nullable: true }) public readonly conventions!: string | null;

  @Expose()
  @ApiProperty({ name: 'task_index' })
  public readonly task_index!: Record<string, unknown>[];

  @Expose()
  @ApiProperty({ name: 'skill_clusters' })
  public readonly skill_clusters!: Record<string, unknown>;

  @Expose()
  @ApiProperty({ name: 'planning_summary', nullable: true })
  public readonly planning_summary!: string | null;

  @Expose()
  @ApiProperty({ name: 'refine_summary', nullable: true })
  public readonly refine_summary!: string | null;

  @Expose()
  @ApiProperty({ name: 'extend_summary', nullable: true })
  public readonly extend_summary!: string | null;

  @Expose() @ApiProperty() public readonly decisions!: Record<string, unknown>[];

  @Expose() @ApiProperty({ name: 'last_indexed_at' }) public readonly last_indexed_at!: Date;

  @Expose()
  @ApiProperty({ name: 'task_count_at_index' })
  public readonly task_count_at_index!: number;

  @Expose() @ApiProperty({ name: 'needs_reindex' }) public readonly needs_reindex!: boolean;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;
  @Expose() @ApiProperty({ name: 'updated_at' }) public readonly updated_at!: Date;
}
