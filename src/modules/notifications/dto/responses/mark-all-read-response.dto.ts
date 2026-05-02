import { ApiProperty } from '@nestjs/swagger';

export class MarkAllReadResponseDto {
  @ApiProperty({ name: 'updated_count', example: 7 })
  public readonly updated_count!: number;
}
