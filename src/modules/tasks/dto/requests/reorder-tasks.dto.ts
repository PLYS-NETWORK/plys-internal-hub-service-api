import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

import {
  IReorderTaskItemRequest,
  IReorderTasksRequest,
} from './interfaces/reorder-tasks.request.interface';

export class ReorderTaskItemDto implements IReorderTaskItemRequest {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  public readonly id!: string;

  @Expose({ name: 'display_order' })
  @ApiProperty({ name: 'display_order', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  public readonly displayOrder!: number;
}

export class ReorderTasksDto implements IReorderTasksRequest {
  @ApiProperty({ type: [ReorderTaskItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReorderTaskItemDto)
  @IsArray()
  @ArrayMinSize(1)
  public readonly tasks!: ReorderTaskItemDto[];
}
