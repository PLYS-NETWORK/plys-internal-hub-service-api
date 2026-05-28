import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

import { ISetBooleanFlagRequest } from './interfaces/set-boolean-flag.request.interface';

export class SetBooleanFlagDto implements ISetBooleanFlagRequest {
  @Expose()
  @ApiProperty({ example: true, description: 'New value for the boolean flag.' })
  @IsBoolean()
  public readonly value!: boolean;
}
