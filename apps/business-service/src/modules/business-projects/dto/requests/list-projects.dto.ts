import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const KEYWORDS_MIN = 2;
const KEYWORDS_MAX = 200;

export class ListProjectsDto extends PageOptionsDto {
  @Expose()
  @ApiPropertyOptional({
    name: 'keywords',
    description: 'Case-insensitive substring filter on project title.',
    minLength: KEYWORDS_MIN,
    maxLength: KEYWORDS_MAX,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(KEYWORDS_MIN)
  @MaxLength(KEYWORDS_MAX)
  @IsOptional()
  public readonly keywords?: string;
}
