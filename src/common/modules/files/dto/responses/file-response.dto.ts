import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IFileResponse } from './interfaces';

@Exclude()
export class FileResponseDto implements IFileResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'owner_user_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly owner_user_id!: string;

  @Expose()
  @ApiProperty({ name: 'mime_type', example: 'image/png' })
  public readonly mime_type!: string;

  @Expose()
  @ApiProperty({ name: 'size_bytes', example: 102400 })
  public readonly size_bytes!: number;

  @Expose()
  @ApiProperty({ name: 'original_name', example: 'avatar.png' })
  public readonly original_name!: string;

  @Expose()
  @ApiProperty({ nullable: true, example: 'avatar' })
  public readonly purpose!: string | null;

  @Expose()
  @ApiProperty({
    example: 'http://localhost:3000/uploads/2026/04/9f4f9c3a-1c6e-4d4a-8b7d-1e2c3a4b5c6d.png',
  })
  public readonly url!: string;

  @Expose()
  @ApiProperty({ name: 'created_at', example: '2026-04-25T10:00:00.000Z' })
  public readonly created_at!: string;
}
