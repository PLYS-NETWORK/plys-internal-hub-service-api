import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { ISubmitProfileRequest } from './submit-profile.request.interface';

export class SubmitProfileDto implements ISubmitProfileRequest {
  @Expose({ name: 'headline' })
  @ApiProperty({ name: 'headline', example: 'Senior Full-Stack Engineer' })
  @IsString()
  @IsNotEmpty()
  public readonly headline!: string;

  @Expose({ name: 'bio' })
  @ApiProperty({ name: 'bio', example: 'I have 7 years of experience building...' })
  @IsString()
  @IsNotEmpty()
  public readonly bio!: string;

  @Expose({ name: 'years_of_experience' })
  @ApiProperty({ name: 'years_of_experience', example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  public readonly yearsOfExperience!: number;

  @Expose({ name: 'skill_ids' })
  @ApiProperty({
    name: 'skill_ids',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
    description: 'UUIDs of the consultant skills (3–10)',
  })
  @IsUUID('4', { each: true })
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  @ArrayUnique()
  public readonly skillIds!: string[];
}
