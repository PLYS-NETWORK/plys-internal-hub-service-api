import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IAdminTransactionOwnerResponse } from './interfaces/admin-transaction-owner.response.interface';

@Exclude()
export class AdminTransactionOwnerResponseDto implements IAdminTransactionOwnerResponse {
  @Expose()
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Profile UUID (consultant or business).',
  })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'user_id', example: '7c1c4e6e-1234-4abc-8def-0123456789ab' })
  public readonly user_id!: string;

  @Expose()
  @ApiProperty({
    example: 'Acme Co.',
    description: 'Consultant `full_name` or business `company_name`.',
  })
  public readonly name!: string;

  @Expose()
  @ApiProperty({ example: 'owner@example.com' })
  public readonly email!: string;
}
