import { AiProvider } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

// Query params for the BFF endpoint. Only `provider` is needed; the FE BFF
// always wants the active key for a single provider per request.
export class GetActiveKeyQueryDto {
  @Expose({ name: 'provider' })
  @ApiProperty({ name: 'provider', enum: AiProvider, example: AiProvider.GROQ })
  @IsEnum(AiProvider)
  public readonly provider!: AiProvider;
}
