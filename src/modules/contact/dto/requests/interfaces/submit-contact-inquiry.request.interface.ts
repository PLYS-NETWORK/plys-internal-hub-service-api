import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';

export interface ISubmitContactInquiryRequest {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly topic: ContactTopic;
  readonly message: string;
  readonly website?: string;
}
