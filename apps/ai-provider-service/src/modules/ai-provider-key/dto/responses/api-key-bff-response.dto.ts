import { ApiProperty } from '@nestjs/swagger';
import { AiProvider } from '@plys/libraries/database/enums';
import { Exclude, Expose } from 'class-transformer';

import { IApiKeyBffResponse, IApiKeyEnvelope } from './interfaces/api-key-bff.response.interface';

@Exclude()
export class ApiKeyEnvelopeDto implements IApiKeyEnvelope {
  @Expose() @ApiProperty({ example: 1 }) public readonly version!: number;
  @Expose() @ApiProperty({ description: 'Base64-encoded 12-byte IV.' }) public readonly iv!: string;
  @Expose()
  @ApiProperty({ description: 'Base64-encoded 16-byte AES-GCM auth tag.' })
  public readonly tag!: string;
  @Expose()
  @ApiProperty({ description: 'Base64-encoded ciphertext.' })
  public readonly ciphertext!: string;
}

@Exclude()
export class ApiKeyBffResponseDto implements IApiKeyBffResponse {
  @Expose()
  @ApiProperty({ enum: AiProvider, example: AiProvider.GROQ })
  public readonly provider!: AiProvider;

  @Expose() @ApiProperty({ example: 'llama-3.3-70b-versatile' }) public readonly model!: string;

  @Expose()
  @ApiProperty({ name: 'key_envelope', type: () => ApiKeyEnvelopeDto })
  public readonly key_envelope!: ApiKeyEnvelopeDto;

  @Expose()
  @ApiProperty({ name: 'key_last4', example: '8c2f' })
  public readonly key_last4!: string;

  @Expose()
  @ApiProperty({
    name: 'expires_at',
    description:
      'ISO-8601 timestamp after which the FE BFF should re-fetch. Bounds the ' +
      'blast radius if FE_BFF_SECRET is rotated.',
  })
  public readonly expires_at!: string;
}
