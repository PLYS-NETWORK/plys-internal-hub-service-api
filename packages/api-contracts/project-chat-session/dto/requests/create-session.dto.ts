import { ApiProperty } from '@nestjs/swagger';
import { ChatSessionMode } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';

import { ICreateSessionRequest } from './interfaces/create-session.request.interface';

export class CreateSessionDto implements ICreateSessionRequest {
  @Expose({ name: 'mode' })
  @ApiProperty({ name: 'mode', enum: ChatSessionMode, example: ChatSessionMode.PLANNING })
  @IsEnum(ChatSessionMode)
  public readonly mode!: ChatSessionMode;

  @Expose({ name: 'title' })
  @ApiProperty({
    name: 'title',
    example: 'Initial planning',
    description: 'Display label shown in the FE session picker. Free text, 1–160 chars.',
  })
  @IsString()
  @Length(1, 160)
  public readonly title!: string;
}
