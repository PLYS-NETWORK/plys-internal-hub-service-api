import { AiProvider } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IApiKeyAdminResponse } from './interfaces/api-key-admin.response.interface';

@Exclude()
export class ApiKeyAdminResponseDto implements IApiKeyAdminResponse {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ enum: AiProvider, example: AiProvider.GROQ })
  public readonly provider!: AiProvider;

  @Expose() @ApiProperty({ example: 'llama-3.3-70b-versatile' }) public readonly model!: string;

  @Expose() @ApiProperty({ example: 'groq-prod-2026-05' }) public readonly label!: string;

  @Expose()
  @ApiProperty({ name: 'master_key_version', example: 1 })
  public readonly master_key_version!: number;

  @Expose()
  @ApiProperty({
    name: 'key_masked',
    example: 'gsk_***...8c2f',
    description: 'Masked rendering of the plaintext last 4 characters.',
  })
  public readonly key_masked!: string;

  @Expose()
  @ApiProperty({ name: 'is_active', example: false })
  public readonly is_active!: boolean;

  @Expose()
  @ApiProperty({ name: 'created_by' })
  public readonly created_by!: string;

  @Expose() @ApiProperty({ name: 'created_at' }) public readonly created_at!: Date;
  @Expose() @ApiProperty({ name: 'updated_at' }) public readonly updated_at!: Date;
}
