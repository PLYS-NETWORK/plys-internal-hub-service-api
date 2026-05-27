import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IConsultantEarningsTrendPointResponse,
  IConsultantEarningsTrendResponse,
} from './interfaces/consultant-earnings-trend.response.interface';

@Exclude()
export class ConsultantEarningsTrendPointDto implements IConsultantEarningsTrendPointResponse {
  @Expose()
  @ApiProperty({ name: 'period_label', example: '2026-04' })
  public readonly period_label!: string;
  @Expose()
  @ApiProperty({ example: '1820.00' })
  public readonly earned!: string;
  @Expose()
  @ApiProperty({ example: '320.00' })
  public readonly pending!: string;
  @Expose()
  @ApiProperty({ example: '500.00' })
  public readonly withdrawn!: string;
  @Expose()
  @ApiProperty({ name: 'cumulative_earned', example: '6480.00' })
  public readonly cumulative_earned!: string;
}

@Exclude()
export class ConsultantEarningsTrendResponseDto implements IConsultantEarningsTrendResponse {
  @Expose()
  @ApiProperty({ example: 'USD' })
  public readonly currency!: string;

  @Expose()
  @ApiProperty({ enum: ['month', 'week'], example: 'month' })
  public readonly granularity!: 'month' | 'week';

  @Expose()
  @Type(() => ConsultantEarningsTrendPointDto)
  @ApiProperty({ type: ConsultantEarningsTrendPointDto, isArray: true })
  public readonly points!: ConsultantEarningsTrendPointDto[];

  @Expose()
  @ApiProperty({ name: 'generated_at', example: '2026-05-16T10:12:30.123Z' })
  public readonly generated_at!: string;
}
