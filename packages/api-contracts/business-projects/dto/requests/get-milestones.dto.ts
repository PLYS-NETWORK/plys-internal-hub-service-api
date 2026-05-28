import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return value;
};

export class GetMilestonesDto {
  @Expose({ name: 'is_remove_cache' })
  @ApiPropertyOptional({
    name: 'is_remove_cache',
    description: 'When true, bypass and refresh the cached milestones payload.',
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  public readonly isRemoveCache?: boolean;
}
