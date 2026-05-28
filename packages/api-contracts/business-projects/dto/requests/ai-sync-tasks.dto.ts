import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaxJsonSize } from '@plys/libraries/common-nest/validators/max-json-size.validator';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

const DESCRIPTION_MAX_BYTES = 50 * 1024;

export type AiSyncTaskAction = 'create' | 'update' | 'delete';
const ACTIONS: AiSyncTaskAction[] = ['create', 'update', 'delete'];

// One row in the batch. The action discriminates which other fields are
// required:
//   - `create`: title + price required, optional description; `task_id`
//     forbidden, `client_temp_id` recommended for FE correlation.
//   - `update`: `task_id` required; any of title/description/price may
//     change; `client_temp_id` optional.
//   - `delete`: `task_id` required; everything else ignored.
//
// Cross-field validation (e.g. forbidding `task_id` on create) lives in the
// service so the error surface is consistent with the mode-status check.
export class AiSyncTaskRowDto {
  @Expose({ name: 'client_temp_id' })
  @ApiPropertyOptional({
    name: 'client_temp_id',
    description:
      'Optional FE-supplied correlation id, echoed back in the per-row ' +
      'response so the FE can map results to its in-flight UI state.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  public readonly clientTempId?: string;

  @Expose({ name: 'action' })
  @ApiProperty({ name: 'action', enum: ACTIONS })
  @IsIn(ACTIONS)
  public readonly action!: AiSyncTaskAction;

  @Expose({ name: 'task_id' })
  @ApiPropertyOptional({ name: 'task_id', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  public readonly taskId?: string;

  @Expose({ name: 'title' })
  @ApiPropertyOptional({ name: 'title', minLength: 3, maxLength: 300 })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  public readonly title?: string;

  @Expose({ name: 'description' })
  @ApiPropertyOptional({
    name: 'description',
    type: 'object',
    additionalProperties: true,
    description: 'Tiptap doc. Capped at 50 KB.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(DESCRIPTION_MAX_BYTES)
  public readonly description?: Record<string, unknown> | null;

  @Expose({ name: 'price' })
  @ApiPropertyOptional({ name: 'price', example: '500.00' })
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  public readonly price?: string;
}

// Top-level batch. Cap at 50 rows — typical AI plan budget; bigger payloads
// are almost certainly noise.
export class AiSyncTasksDto {
  @Expose({ name: 'tasks' })
  @ApiProperty({
    name: 'tasks',
    type: () => [AiSyncTaskRowDto],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AiSyncTaskRowDto)
  public readonly tasks!: AiSyncTaskRowDto[];
}
