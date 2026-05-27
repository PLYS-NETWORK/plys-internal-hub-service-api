import { ApiProperty } from '@nestjs/swagger';
import { TimezoneDate } from '@plys/libraries/common-nest/decorators/timezone-date.decorator';
import { Exclude, Expose, Type } from 'class-transformer';

import { BoardAttachmentResponseDto } from './board-attachment-response.dto';
import {
  IBoardResultAuthor,
  IBoardResultResponse,
} from './interfaces/board-result.response.interface';

@Exclude()
export class BoardResultAuthorDto implements IBoardResultAuthor {
  @Expose() @ApiProperty({ name: 'consultant_id' }) public readonly consultant_id!: string;
  @Expose() @ApiProperty({ name: 'full_name' }) public readonly full_name!: string;
  @Expose()
  @ApiProperty({ name: 'avatar_url', nullable: true })
  public readonly avatar_url!: string | null;
}

@Exclude()
export class BoardResultResponseDto implements IBoardResultResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'task_id' }) public readonly task_id!: string;

  @Expose()
  @Type(() => BoardResultAuthorDto)
  @ApiProperty({ type: () => BoardResultAuthorDto })
  public readonly author!: BoardResultAuthorDto;

  @Expose()
  @ApiProperty({ type: 'object', additionalProperties: true })
  public readonly remarks!: Record<string, unknown>;

  @Expose() @ApiProperty({ name: 'is_edited' }) public readonly is_edited!: boolean;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'edited_at', nullable: true })
  public readonly edited_at!: string | null;

  @Expose()
  @TimezoneDate()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: string;

  @Expose()
  @Type(() => BoardAttachmentResponseDto)
  @ApiProperty({ type: () => BoardAttachmentResponseDto, isArray: true })
  public readonly attachments!: BoardAttachmentResponseDto[];
}
