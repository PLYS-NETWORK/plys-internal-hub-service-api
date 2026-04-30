import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { BoardAttachmentResponseDto } from './board-attachment-response.dto';
import {
  IBoardCommentAuthor,
  IBoardCommentResponse,
} from './interfaces/board-comment.response.interface';

@Exclude()
export class BoardCommentAuthorDto implements IBoardCommentAuthor {
  @Expose() @ApiProperty({ name: 'user_id' }) public readonly user_id!: string;
  @Expose() @ApiProperty() public readonly name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardCommentResponseDto implements IBoardCommentResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;

  @Expose()
  @Type(() => BoardCommentAuthorDto)
  @ApiProperty({ type: () => BoardCommentAuthorDto })
  public readonly author!: BoardCommentAuthorDto;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true })
  public readonly comment!: Record<string, unknown>;

  @Expose() @ApiProperty({ name: 'is_edited' }) public readonly is_edited!: boolean;
  @Expose()
  @ApiProperty({ name: 'edited_at', nullable: true })
  public readonly edited_at!: Date | null;
  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;

  @Expose()
  @Type(() => BoardAttachmentResponseDto)
  @ApiProperty({ type: () => BoardAttachmentResponseDto, isArray: true })
  public readonly attachments!: BoardAttachmentResponseDto[];
}
