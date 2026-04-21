import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { IUpdateTaskCommentRequest } from './interfaces/update-task-comment.request.interface';

export class UpdateTaskCommentDto implements IUpdateTaskCommentRequest {
  @Expose()
  @ApiProperty({ example: 'Updated comment text.' })
  @IsString()
  @IsNotEmpty()
  public readonly body!: string;
}
