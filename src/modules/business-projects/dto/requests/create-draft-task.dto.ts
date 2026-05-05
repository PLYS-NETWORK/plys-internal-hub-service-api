import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumberString, IsObject, IsOptional, IsString, Length } from 'class-validator';

import { ICreateDraftTaskRequest } from './interfaces/create-draft-task.request.interface';

export class CreateDraftTaskDto implements ICreateDraftTaskRequest {
  @Expose({ name: 'title' })
  @ApiProperty({ name: 'title', example: 'Implement OAuth flow' })
  @IsString()
  @Length(3, 300)
  public readonly title!: string;

  @Expose({ name: 'description' })
  @ApiPropertyOptional({ name: 'description', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  public readonly description?: Record<string, unknown> | null;

  @Expose({ name: 'price' })
  @ApiProperty({ name: 'price', example: '500.00', description: 'Decimal string > 0' })
  @IsNumberString({ no_symbols: false })
  public readonly price!: string;
}
