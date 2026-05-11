import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { IContactInquirySubmittedResponse } from './interfaces/contact-inquiry-submitted.response.interface';

export class ContactInquirySubmittedResponseDto implements IContactInquirySubmittedResponse {
  @Expose()
  @ApiProperty({ name: 'id', example: 'b3f9a3c0-1234-4cde-9876-abcdef012345' })
  public readonly id!: string;
}
