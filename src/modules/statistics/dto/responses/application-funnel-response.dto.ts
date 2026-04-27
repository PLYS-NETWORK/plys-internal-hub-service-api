import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  ApplicationFunnelStage,
  IApplicationFunnelResponse,
  IApplicationFunnelStage,
} from './interfaces/application-funnel.response.interface';

@Exclude()
export class ApplicationFunnelStageDto implements IApplicationFunnelStage {
  @Expose()
  @ApiProperty({ enum: ['applied', 'reviewed', 'approved', 'active'], example: 'applied' })
  public readonly stage!: ApplicationFunnelStage;

  @Expose()
  @ApiProperty({ example: 86 })
  public readonly count!: number;

  @Expose()
  @ApiProperty({ name: 'conversion_rate', nullable: true, example: 0.779 })
  public readonly conversion_rate!: number | null;
}

@Exclude()
export class ApplicationFunnelResponseDto implements IApplicationFunnelResponse {
  @Expose()
  @ApiProperty({ type: [ApplicationFunnelStageDto] })
  @Type(() => ApplicationFunnelStageDto)
  public readonly stages!: ApplicationFunnelStageDto[];

  @Expose()
  @ApiProperty({ name: 'overall_conversion_rate', example: 0.314 })
  public readonly overall_conversion_rate!: number;
}
