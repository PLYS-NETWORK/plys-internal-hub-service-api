import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

import { ConsultantSkillResponseDto } from './consultant-skill-response.dto';
import { IConsultantProfileResponse } from './interfaces/consultant-profile.response.interface';

@Exclude()
export class ConsultantProfileResponseDto implements IConsultantProfileResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose({ name: 'userId' })
  @ApiProperty({ name: 'user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly user_id!: string;

  @Expose({ name: 'fullName' })
  @ApiProperty({ name: 'full_name', example: 'Jane Doe' })
  public readonly full_name!: string;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly bio!: string | null;

  @Expose({ name: 'yearsOfExperience' })
  @ApiProperty({ name: 'years_of_experience', nullable: true, example: 5 })
  public readonly years_of_experience!: number | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'full_time' })
  public readonly availability!: string | null;

  @Expose({ name: 'avatarUrl' })
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;

  @Expose({ name: 'addressLine' })
  @ApiProperty({ name: 'address_line', nullable: true })
  public readonly address_line!: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  public readonly city!: string | null;

  @Expose({ name: 'stateProvince' })
  @ApiProperty({ name: 'state_province', nullable: true })
  public readonly state_province!: string | null;

  @Expose({ name: 'postalCode' })
  @ApiProperty({ name: 'postal_code', nullable: true })
  public readonly postal_code!: string | null;

  @Expose({ name: 'countryCode' })
  @ApiProperty({ name: 'country_code', nullable: true })
  public readonly country_code!: string | null;

  @Expose({ name: 'phoneNumber' })
  @ApiProperty({ name: 'phone_number', nullable: true })
  public readonly phone_number!: string | null;

  @Expose({ name: 'isVerified' })
  @ApiProperty({ name: 'is_verified', example: false })
  public readonly is_verified!: boolean;

  @Expose({ name: 'accountBalance' })
  @Transform(({ value }: { value: string }) => parseFloat(value))
  @ApiProperty({
    name: 'account_balance',
    example: 0.0,
    description: 'Account balance (2 decimal places)',
  })
  public readonly account_balance!: number;

  @Expose({ name: 'createdAt' })
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;

  @Expose()
  @ApiProperty({ type: [ConsultantSkillResponseDto] })
  @Type(() => ConsultantSkillResponseDto)
  public readonly skills!: ConsultantSkillResponseDto[];
}
