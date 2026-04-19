import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PageOptionsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public readonly limit: number = 20;

  /**
   * Column name to sort by. Concrete DTOs or services should document and
   * whitelist the valid values for their entity.
   */
  @ApiPropertyOptional({ description: 'Column to sort by (entity-specific).' })
  @IsString()
  @IsOptional()
  public readonly sort_by?: string;

  /** Sort direction. Defaults to `DESC` in query builders when omitted. */
  @ApiPropertyOptional({ enum: Order, description: 'Sort direction.' })
  @IsEnum(Order)
  @IsOptional()
  public readonly order_by?: Order;

  public get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
