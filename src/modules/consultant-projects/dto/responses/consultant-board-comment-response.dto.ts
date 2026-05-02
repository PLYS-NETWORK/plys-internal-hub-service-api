import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { ConsultantBoardAttachmentResponseDto } from './consultant-board-attachment-response.dto';
import {
  IConsultantBoardCommentAuthor,
  IConsultantBoardCommentResponse,
} from './interfaces/consultant-board-comment.response.interface';

@Exclude()
export class ConsultantBoardCommentAuthorDto implements IConsultantBoardCommentAuthor {
  @Expose() @ApiProperty({ name: 'user_id' }) public readonly user_id!: string;
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;

  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class ConsultantBoardCommentResponseDto implements IConsultantBoardCommentResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;

  @Expose()
  @Type(() => ConsultantBoardCommentAuthorDto)
  @ApiProperty({ type: () => ConsultantBoardCommentAuthorDto })
  public readonly author!: ConsultantBoardCommentAuthorDto;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true })
  public readonly comment!: Record<string, unknown>;

  @Expose() @ApiProperty({ name: 'is_edited' }) public readonly is_edited!: boolean;

  @Expose()
  @ApiProperty({ name: 'edited_at', nullable: true })
  public readonly edited_at!: Date | null;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;

  @Expose()
  @Type(() => ConsultantBoardAttachmentResponseDto)
  @ApiProperty({ type: () => ConsultantBoardAttachmentResponseDto, isArray: true })
  public readonly attachments!: ConsultantBoardAttachmentResponseDto[];
}
