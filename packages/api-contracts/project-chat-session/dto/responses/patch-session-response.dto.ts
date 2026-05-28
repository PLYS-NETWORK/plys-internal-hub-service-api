import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IPatchSessionResponse } from './interfaces/chat-session.response.interface';

@Exclude()
export class PatchSessionResponseDto implements IPatchSessionResponse {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ name: 'message_count' }) public readonly message_count!: number;
  @Expose() @ApiProperty({ name: 'updated_at' }) public readonly updated_at!: Date;
}
