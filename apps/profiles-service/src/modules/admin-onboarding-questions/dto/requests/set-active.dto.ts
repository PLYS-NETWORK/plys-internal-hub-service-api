import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

import { ISetActiveFlagRequest } from './interfaces/set-active.request.interface';

export class SetActiveFlagDto implements ISetActiveFlagRequest {
  @Expose()
  @ApiProperty({ example: true, description: 'New value for the is_active flag.' })
  @IsBoolean()
  public readonly value!: boolean;
}
