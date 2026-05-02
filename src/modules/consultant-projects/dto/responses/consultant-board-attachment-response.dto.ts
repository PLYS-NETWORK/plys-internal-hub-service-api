import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantBoardAttachmentResponse } from './interfaces/consultant-board-attachment.response.interface';

@Exclude()
export class ConsultantBoardAttachmentResponseDto implements IConsultantBoardAttachmentResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'file_id', nullable: true })
  public readonly file_id!: string | null;

  @Expose() @ApiProperty({ name: 'file_name' }) public readonly file_name!: string;

  @Expose() @ApiProperty({ name: 'file_url' }) public readonly file_url!: string;

  @Expose()
  @ApiProperty({ name: 'mime_type', nullable: true })
  public readonly mime_type!: string | null;

  @Expose()
  @ApiProperty({ name: 'file_size_bytes', nullable: true })
  public readonly file_size_bytes!: number | null;

  @Expose() @ApiProperty({ name: 'uploaded_at' }) public readonly uploaded_at!: Date;
}
