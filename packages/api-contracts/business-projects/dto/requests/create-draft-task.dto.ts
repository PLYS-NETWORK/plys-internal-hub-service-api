import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaxJsonSize } from '@plys/libraries/common-nest/validators/max-json-size.validator';
import { Expose } from 'class-transformer';
import { IsNumberString, IsObject, IsOptional, IsString, Length } from 'class-validator';

import { ICreateDraftTaskRequest } from './interfaces/create-draft-task.request.interface';

const DESCRIPTION_MAX_BYTES = 50 * 1024;

export class CreateDraftTaskDto implements ICreateDraftTaskRequest {
  @Expose({ name: 'title' })
  @ApiProperty({ name: 'title', example: 'Implement OAuth flow' })
  @IsString()
  @Length(3, 300)
  public readonly title!: string;

  @Expose({ name: 'description' })
  @ApiPropertyOptional({
    name: 'description',
    type: 'object',
    additionalProperties: true,
    description: 'Tiptap doc, opaque to the BE. Capped at 50 KB.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(DESCRIPTION_MAX_BYTES)
  public readonly description?: Record<string, unknown> | null;

  @Expose({ name: 'price' })
  @ApiProperty({ name: 'price', example: '500.00', description: 'Decimal string > 0' })
  @IsNumberString({ no_symbols: false })
  public readonly price!: string;
}
