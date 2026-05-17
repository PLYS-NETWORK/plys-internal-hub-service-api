import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsDate, IsNotEmpty, MinDate } from 'class-validator';

import { IAssignConsultantTaskRequest } from './interfaces/assign-consultant-task.request.interface';

export class AssignConsultantTaskDto implements IAssignConsultantTaskRequest {
  @Expose({ name: 'due_date' })
  @ApiProperty({
    name: 'due_date',
    description: 'ISO-8601 timestamp for when the consultant commits to deliver.',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  // Callback form so the lower bound re-evaluates per request — decorator
  // arguments are frozen at module load, which would make a static `new Date()`
  // accept past timestamps after a few seconds of uptime.
  @MinDate(() => new Date())
  public readonly dueDate!: Date;
}
