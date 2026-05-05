import { SanitizeText } from '@common/transformers/sanitize-text.transformer';
import { MaxJsonSize } from '@common/validators/max-json-size.validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

import {
  ITaskSummaryPatch,
  IUpdateDerivedContextRequest,
} from './interfaces/update-derived-context.request.interface';

export class TaskSummaryPatchDto implements ITaskSummaryPatch {
  @Expose({ name: 'task_id' })
  @ApiPropertyOptional({ name: 'task_id', format: 'uuid' })
  @IsUUID('4')
  public readonly taskId!: string;

  @Expose({ name: 'summary' })
  @SanitizeText({ fieldLabel: 'task_summary' })
  @ApiPropertyOptional({
    name: 'summary',
    example: 'Recruit and interview 8 target users',
  })
  @IsString()
  @Length(1, 500)
  public readonly summary!: string;
}

// All fields optional — the FE merges in whatever it just (re-)derived. The
// service applies a transactional merge, appends a `derived_write` decision
// for audit, and clears `needs_reindex`.
export class UpdateDerivedContextDto implements IUpdateDerivedContextRequest {
  @Expose({ name: 'domain' })
  @SanitizeText({ fieldLabel: 'domain' })
  @ApiPropertyOptional({
    name: 'domain',
    example: 'Consumer mobile health app',
    description: 'One-line characterisation of what the project does.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  public readonly domain?: string;

  @Expose({ name: 'primary_stack' })
  @ApiPropertyOptional({
    name: 'primary_stack',
    type: [String],
    example: ['React Native', 'Node.js', 'PostgreSQL'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  public readonly primaryStack?: string[];

  @Expose({ name: 'conventions' })
  @SanitizeText({ fieldLabel: 'conventions' })
  @ApiPropertyOptional({
    name: 'conventions',
    description: 'Pricing / difficulty / structuring conventions in plain text.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 4_000)
  public readonly conventions?: string;

  @Expose({ name: 'planning_summary' })
  @SanitizeText({ fieldLabel: 'planning_summary' })
  @ApiPropertyOptional({ name: 'planning_summary' })
  @IsOptional()
  @IsString()
  @Length(0, 8_000)
  public readonly planningSummary?: string;

  @Expose({ name: 'refine_summary' })
  @SanitizeText({ fieldLabel: 'refine_summary' })
  @ApiPropertyOptional({ name: 'refine_summary' })
  @IsOptional()
  @IsString()
  @Length(0, 8_000)
  public readonly refineSummary?: string;

  @Expose({ name: 'extend_summary' })
  @SanitizeText({ fieldLabel: 'extend_summary' })
  @ApiPropertyOptional({ name: 'extend_summary' })
  @IsOptional()
  @IsString()
  @Length(0, 8_000)
  public readonly extendSummary?: string;

  @Expose({ name: 'skill_clusters' })
  @ApiPropertyOptional({
    name: 'skill_clusters',
    description: 'FE-managed clusters keyed by skill UUID. Capped at 16 KB.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(16 * 1024)
  public readonly skillClusters?: Record<string, unknown>;

  @Expose({ name: 'task_summaries' })
  @ApiPropertyOptional({
    name: 'task_summaries',
    type: () => [TaskSummaryPatchDto],
    description:
      'Patches `task_index[].summary` by task_id. Tasks not in the index are ' +
      'silently skipped — the BE owns the index shape.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskSummaryPatchDto)
  public readonly taskSummaries?: TaskSummaryPatchDto[];
}
