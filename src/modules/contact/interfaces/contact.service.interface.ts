import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';

export interface ISubmitContactInquiryInput {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly topic: ContactTopic;
  readonly message: string;
}

export interface IContactInquirySubmitResult {
  readonly id: string;
}

export interface IContactService {
  /**
   * Persists a contact inquiry and dispatches notification + acknowledgement
   * emails fire-and-forget. The submitter sees success as soon as the row
   * is persisted; email failures are logged and reflected on `email_status`.
   */
  submit(input: ISubmitContactInquiryInput): Promise<IContactInquirySubmitResult>;
}
