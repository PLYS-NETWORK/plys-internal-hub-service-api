import { ApiProperty } from '@nestjs/swagger';

import { NotificationResponseDto } from './notification-response.dto';

export class NotificationCursorPageDto {
  @ApiProperty({ type: () => NotificationResponseDto, isArray: true })
  public readonly data!: NotificationResponseDto[];

  @ApiProperty({
    name: 'next_cursor',
    nullable: true,
    description:
      'Opaque cursor to pass back as `cursor` for the next page. `null` when no more pages.',
  })
  public readonly next_cursor!: string | null;

  @ApiProperty({ name: 'has_more', example: true })
  public readonly has_more!: boolean;
}
