import { AiAssistantType } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

// Query params for the BFF endpoint. The FE BFF passes the assistant feature
// it's serving; the gateway returns whichever active key powers that feature
// (regardless of which provider it talks to).
export class GetActiveKeyQueryDto {
  @Expose({ name: 'assistant_type' })
  @ApiProperty({
    name: 'assistant_type',
    enum: AiAssistantType,
    example: AiAssistantType.CHAT_BOX,
  })
  @IsEnum(AiAssistantType)
  public readonly assistantType!: AiAssistantType;
}
