import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsUUID } from 'class-validator';

import { IAssignTaskRequest } from './interfaces/assign-task.request.interface';

export class AssignTaskDto implements IAssignTaskRequest {
  @Expose({ name: 'consultant_id' })
  @ApiProperty({ name: 'consultant_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  public readonly consultantId!: string;
}
