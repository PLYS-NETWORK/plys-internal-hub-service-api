import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

export class AssignTaskDto {
  @Expose({ name: 'consultant_id' })
  @ApiProperty({ name: 'consultant_id' })
  @IsUUID('4')
  public readonly consultantId!: string;
}
