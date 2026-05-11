import { AbstractRepository } from '@common/repositories';
import { ContactInquiry } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import type { IContactInquiryRepository, IInsertContactInquiryInput } from './interfaces';

@Injectable()
export class ContactInquiryRepository
  extends AbstractRepository<ContactInquiry>
  implements IContactInquiryRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ContactInquiry, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ContactInquiryRepository(manager) as this;
  }

  /** @inheritdoc */
  public async insertInquiry(input: IInsertContactInquiryInput): Promise<ContactInquiry> {
    const entity = this.repository.create({
      name: input.name,
      email: input.email,
      company: input.company,
      topic: input.topic,
      message: input.message,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return this.repository.save(entity);
  }

  /** @inheritdoc */
  public async markEmailFailure(
    id: string,
    kind: 'notification' | 'acknowledgement',
  ): Promise<void> {
    // Compare-and-set inside SQL so concurrent .catch handlers do not race.
    // notification failure:  pending → failed_notification | failed_acknowledgement → failed_both
    // acknowledgement failure: pending → failed_acknowledgement | failed_notification → failed_both
    const cases =
      kind === 'notification'
        ? `CASE
             WHEN email_status = 'pending' THEN 'failed_notification'
             WHEN email_status = 'failed_acknowledgement' THEN 'failed_both'
             ELSE email_status
           END`
        : `CASE
             WHEN email_status = 'pending' THEN 'failed_acknowledgement'
             WHEN email_status = 'failed_notification' THEN 'failed_both'
             ELSE email_status
           END`;

    await this.repository
      .createQueryBuilder()
      .update(ContactInquiry)
      .set({ emailStatus: () => cases })
      .where('id = :id', { id })
      .execute();
  }

  /** @inheritdoc */
  public async markEmailSent(id: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(ContactInquiry)
      .set({ emailStatus: 'sent' })
      .where('id = :id AND email_status = :pending', { id, pending: 'pending' })
      .execute();
  }

  /** @inheritdoc */
  public async findById(id: string): Promise<ContactInquiry | null> {
    return this.repository.findOne({ where: { id } });
  }
}
