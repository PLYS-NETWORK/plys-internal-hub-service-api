import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumberString, IsObject, IsOptional, IsString, Length } from 'class-validator';

import { IUpdateDraftTaskRequest } from './interfaces/update-draft-task.request.interface';

export class UpdateDraftTaskDto implements IUpdateDraftTaskRequest {
  @Expose({ name: 'title' })
  @ApiPropertyOptional({ name: 'title', example: 'Implement OAuth flow' })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  public readonly title?: string;

  @Expose({ name: 'description' })
  @ApiPropertyOptional({
    name: 'description',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  public readonly description?: Record<string, unknown> | null;

  @Expose({ name: 'price' })
  @ApiPropertyOptional({ name: 'price', example: '500.00', description: 'Decimal string > 0' })
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  public readonly price?: string;
}
