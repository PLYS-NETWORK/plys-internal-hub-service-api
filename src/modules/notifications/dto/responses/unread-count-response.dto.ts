import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ name: 'unread_count', example: 7 })
  public readonly unread_count!: number;
}
