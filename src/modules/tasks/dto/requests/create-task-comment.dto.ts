import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { ICreateTaskCommentRequest } from './interfaces/create-task-comment.request.interface';

export class CreateTaskCommentDto implements ICreateTaskCommentRequest {
  @Expose()
  @ApiProperty({ example: 'I have completed the first subtask.' })
  @IsString()
  @IsNotEmpty()
  public readonly body!: string;
}
