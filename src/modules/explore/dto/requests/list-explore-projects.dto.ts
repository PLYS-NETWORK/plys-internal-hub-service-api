import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { IListExploreProjectsRequest } from './list-explore-projects.request.interface';

export class ListExploreProjectsDto extends PageOptionsDto implements IListExploreProjectsRequest {
  @Expose({ name: 'skill_ids' })
  @ApiPropertyOptional({
    name: 'skill_ids',
    description:
      'Comma-separated UUIDs. A project matches if it requires ANY of the listed skills.',
    example: 'b0b1f9d0-1111-4222-8333-444455556666,c1c2e8a0-aaaa-4bbb-8ccc-ddddeeeeefff',
  })
  @IsOptional()
  // Query strings always arrive as strings — split on `,` before validating
  // each entry as a UUID. Whitespace and empty fragments are dropped so the
  // client can send `skill_ids=a,,b` without a 400.
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) {
      return (value as unknown[])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((s) => s.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  public readonly skillIds?: string[];

  @Expose({ name: 'title' })
  @ApiPropertyOptional({
    name: 'title',
    description: 'Case-insensitive substring match on the project title.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly title?: string;
}
