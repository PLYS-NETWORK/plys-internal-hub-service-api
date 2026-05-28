import { ApiProperty } from '@nestjs/swagger';
import { ChatMessageRole } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IChatMessagePageResponse,
  IChatMessageResponse,
} from './interfaces/chat-message.response.interface';

@Exclude()
export class ChatMessageResponseDto implements IChatMessageResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ example: 42 }) public readonly seq!: number;

  @Expose()
  @ApiProperty({ enum: ChatMessageRole })
  public readonly role!: ChatMessageRole;

  @Expose()
  @ApiProperty({ description: 'Vercel AI SDK UIMessage `parts` payload.' })
  public readonly parts!: unknown;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Optional AI SDK metadata.' })
  public readonly metadata!: Record<string, unknown> | null;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;
}

@Exclude()
export class ChatMessagePageResponseDto implements IChatMessagePageResponse {
  @Expose()
  @ApiProperty({ type: () => [ChatMessageResponseDto] })
  @Type(() => ChatMessageResponseDto)
  public readonly messages!: ChatMessageResponseDto[];

  @Expose()
  @ApiProperty({
    name: 'next_cursor',
    nullable: true,
    description: 'Pass back as `before` for the next page; null when exhausted.',
  })
  public readonly next_cursor!: number | null;
}
