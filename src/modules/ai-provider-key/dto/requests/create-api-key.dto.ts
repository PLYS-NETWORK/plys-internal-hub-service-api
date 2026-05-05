import { AiProvider } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';

import { ICreateApiKeyRequest } from './interfaces/create-api-key.request.interface';

export class CreateApiKeyDto implements ICreateApiKeyRequest {
  @Expose({ name: 'provider' })
  @ApiProperty({ name: 'provider', enum: AiProvider, example: AiProvider.GROQ })
  @IsEnum(AiProvider)
  public readonly provider!: AiProvider;

  @Expose({ name: 'model' })
  @ApiProperty({
    name: 'model',
    example: 'llama-3.3-70b-versatile',
    description: 'Model identifier passed verbatim to the provider SDK by the FE BFF.',
  })
  @IsString()
  @Length(1, 80)
  public readonly model!: string;

  @Expose({ name: 'label' })
  @ApiProperty({
    name: 'label',
    example: 'groq-prod-2026-05',
    description: 'Human-readable identifier for admin views and audit logs.',
  })
  @IsString()
  @Length(1, 80)
  public readonly label!: string;

  @Expose({ name: 'key' })
  @ApiProperty({
    name: 'key',
    description:
      'Plaintext API key. Read once, encrypted at rest, and never echoed back. ' +
      'Minimum 8 chars to discourage typos; max 200 covers any provider.',
  })
  @IsString()
  @Length(8, 200)
  public readonly key!: string;
}
