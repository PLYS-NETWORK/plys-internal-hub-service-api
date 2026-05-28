import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { BusinessProfileResponseDto } from './business-profile-response.dto';
import { IAdminBusinessProfileDetailResponse } from './interfaces/admin-business-profile-detail.response.interface';

/**
 * Admin-only detail view. Extends the user-scoped DTO with three fields
 * sourced from the joined `users` row (`email`, `register_date`,
 * `last_login`). The base class already declares `@Exclude()` so plain
 * properties not exposed here are stripped during serialisation.
 */
export class AdminBusinessProfileDetailResponseDto
  extends BusinessProfileResponseDto
  implements IAdminBusinessProfileDetailResponse
{
  @Expose()
  @ApiProperty({ example: 'owner@acme.com' })
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'register_date', description: 'Auth account creation timestamp.' })
  public readonly register_date!: Date;

  @Expose()
  @ApiProperty({
    name: 'last_login',
    nullable: true,
    description: 'Latest login timestamp for the linked auth account; null until first login.',
  })
  public readonly last_login!: Date | null;
}
