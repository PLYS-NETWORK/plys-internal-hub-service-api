import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const KEYWORDS_MIN = 2;
const KEYWORDS_MAX = 200;

export class SearchProjectsDto extends PageOptionsDto {
  @Expose()
  @ApiPropertyOptional({
    name: 'keywords',
    description: 'Case-insensitive substring filter on project title OR code.',
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
