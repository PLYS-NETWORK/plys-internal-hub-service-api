import { ApiProperty } from '@nestjs/swagger';
import { ChatSessionMode, ChatSessionStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { IChatSessionListItemResponse } from './interfaces/chat-session.response.interface';

@Exclude()
export class ChatSessionListItemResponseDto implements IChatSessionListItemResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: ChatSessionMode })
  public readonly mode!: ChatSessionMode;

  @Expose()
  @ApiProperty({ nullable: true, description: 'FE-driven sub-state (PLANNING flow only).' })
  public readonly stage!: string | null;

  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({ enum: ChatSessionStatus })
  public readonly status!: ChatSessionStatus;

  @Expose() @ApiProperty({ name: 'message_count' }) public readonly message_count!: number;

  @Expose()
  @ApiProperty({ name: 'implemented_at', nullable: true })
  public readonly implemented_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'created_task_ids', type: [String], nullable: true })
  public readonly created_task_ids!: string[] | null;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;
  @Expose() @ApiProperty({ name: 'updated_at' }) public readonly updated_at!: Date;
}
