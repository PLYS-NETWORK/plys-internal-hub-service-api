import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ChatSessionListItemResponseDto } from './chat-session-list-item-response.dto';
import { IChatSessionMetaResponse } from './interfaces/chat-session.response.interface';

@Exclude()
export class ChatSessionMetaResponseDto
  extends ChatSessionListItemResponseDto
  implements IChatSessionMetaResponse
{
  @Expose() @ApiProperty({ name: 'project_id' }) public readonly project_id!: string;

  @Expose() @ApiProperty({ name: 'user_id' }) public readonly user_id!: string;

  @Expose()
  @ApiProperty({
    description:
      'Free-form FE working state (current draft, partial inputs, …). Replaced ' +
      'wholesale on PATCH /chat-sessions/:id; never read by the BE.',
    type: 'object',
    additionalProperties: true,
  })
  public readonly draft!: Record<string, unknown>;
}
