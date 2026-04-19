import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { ICreateProjectRequest } from './interfaces/create-project.request.interface';

export class CreateProjectDto implements ICreateProjectRequest {
  @Expose()
  @ApiProperty({ name: 'title', example: 'Build an e-commerce platform', maxLength: 300 })
  @IsString()
  @MaxLength(300)
  public readonly title!: string;

  @Expose()
  @ApiPropertyOptional({ name: 'introduction', example: 'We need a full-stack team...' })
  @IsString()
  @IsOptional()
  public readonly introduction?: string;

  @Expose()
  @ApiPropertyOptional({ name: 'required_consultants', example: 2, minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly required_consultants?: number;

  @Expose()
  @ApiPropertyOptional({
    name: 'skills',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Array of unique skill UUIDs.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @IsOptional()
  public readonly skills?: string[];
}
