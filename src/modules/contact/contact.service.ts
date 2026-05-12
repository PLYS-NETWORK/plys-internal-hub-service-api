import { EmailService } from '@common/modules/email';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';
import { ContactInquiryRepository } from '@modules/unit-of-work/repositories';
import { Injectable } from '@nestjs/common';

import type {
  IContactInquirySubmitResult,
  IContactService,
  ISubmitContactInquiryInput,
} from './interfaces/contact.service.interface';

@Injectable()
export class ContactService implements IContactService {
  private readonly logger: AppLogger;

  constructor(
    private readonly contactInquiryRepository: ContactInquiryRepository,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ContactService.name, requestContext);
  }

  /** @inheritdoc */
  public async submit(input: ISubmitContactInquiryInput): Promise<IContactInquirySubmitResult> {
    const ipAddress = this.requestContext.ipAddress || null;
    const userAgent = this.requestContext.userAgent;

    const inquiry = await this.contactInquiryRepository.insertInquiry({
      name: input.name,
      email: input.email,
      company: input.company,
      topic: input.topic,
      message: input.message,
      ipAddress,
      userAgent,
    });

    this.logger.log(
      `submit — persisted | id: ${inquiry.id}, topic: ${input.topic}, ip: ${ipAddress ?? 'none'}`,
    );

    const inbox = this.inboxForTopic(input.topic);

    // Fire-and-forget: do NOT await. We log + flip email_status on failure.
    this.dispatchEmails(inquiry.id, inbox, input, ipAddress);

    return { id: inquiry.id };
  }

  /**
   * Tracks completion of both email sends so we can transition email_status
   * to `sent` when both succeed, or to the appropriate failure state when
   * one or both fail. The compare-and-set in markEmailFailure handles the
   * concurrent-failure race.
   */
  private dispatchEmails(
    id: string,
    inbox: string,
    input: ISubmitContactInquiryInput,
    ipAddress: string | null,
  ): void {
    const submittedAt = new Date();

    const notification = this.emailService
      .sendContactInquiryNotification(inbox, {
        name: input.name,
        email: input.email,
        company: input.company,
        topic: input.topic,
        message: input.message,
        submittedAt,
        ipAddress,
      })
      .then(() => true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`submit — notification email failed | id: ${id} | error: ${message}`);
        return this.contactInquiryRepository.markEmailFailure(id, 'notification').then(() => false);
      });

    const acknowledgement = this.emailService
      .sendContactInquiryAcknowledgement(input.email, {
        name: input.name,
        topic: input.topic,
      })
      .then(() => true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`submit — acknowledgement email failed | id: ${id} | error: ${message}`);
        return this.contactInquiryRepository
          .markEmailFailure(id, 'acknowledgement')
          .then(() => false);
      });

    // Once both have settled, if both succeeded, transition pending → sent.
    void Promise.all([notification, acknowledgement]).then(([n, a]) => {
      if (n && a) {
        void this.contactInquiryRepository.markEmailSent(id).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`submit — markEmailSent failed | id: ${id} | error: ${message}`);
        });
      }
    });
  }

  private inboxForTopic(topic: ContactTopic): string {
    switch (topic) {
      case 'sales':
        return this.env.resendContactInboxSales;
      case 'partnership':
        return this.env.resendContactInboxPartners;
      case 'press':
        return this.env.resendContactInboxPress;
      case 'other':
        return this.env.resendContactInboxSupport;
    }
  }
}
