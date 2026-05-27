import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '@plys/libraries/database/enums';
import { Expose } from 'class-transformer';
import { IsIn } from 'class-validator';

// Only `draft → configured` is accepted via this endpoint. Other transitions
// (publish, start, cancel) go through dedicated lifecycle flows. The whitelist
// is type-checked, so adding a new transition here means an explicit code
// change rather than a config tweak.
const ALLOWED_TARGET_STATUSES: ProjectStatus[] = [ProjectStatus.CONFIGURED];

export class TransitionProjectStatusDto {
  @Expose({ name: 'status' })
  @ApiProperty({
    name: 'status',
    enum: ALLOWED_TARGET_STATUSES,
    example: ProjectStatus.CONFIGURED,
    description: 'Target status. Currently only `configured` is accepted.',
  })
  @IsIn(ALLOWED_TARGET_STATUSES)
  public readonly status!: ProjectStatus;
}
