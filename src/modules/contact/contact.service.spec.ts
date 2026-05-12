import { EmailService } from '@common/modules/email';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import type { ContactInquiry } from '@database/entities';
import { describe, expect, it, jest } from '@jest/globals';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';

import { ContactService } from './contact.service';

function buildInquiry(overrides: Partial<ContactInquiry> = {}): ContactInquiry {
  return {
    id: 'inquiry-id',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engine Co.',
    topic: 'sales',
    message: 'We would like enterprise pricing.',
    status: 'received',
    emailStatus: 'pending',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date('2026-05-11T00:00:00Z'),
    updatedAt: new Date('2026-05-11T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    ...overrides,
  } as ContactInquiry;
}

function makeService(
  overrides: {
    uow?: Partial<{ contactInquiries: Partial<UnitOfWorkService['contactInquiries']> }>;
    email?: Partial<EmailService>;
    env?: Partial<EnvironmentsService>;
    ctx?: Partial<RequestContextService>;
  } = {},
): ContactService {
  const contactInquiries = {
    insertInquiry: jest.fn(async () => buildInquiry()),
    markEmailFailure: jest.fn(async () => undefined),
    markEmailSent: jest.fn(async () => undefined),
    ...(overrides.uow?.contactInquiries ?? {}),
  };

  const uow = {
    contactInquiries,
  } as unknown as UnitOfWorkService;

  const email = {
    sendContactInquiryNotification: jest.fn(async () => undefined),
    sendContactInquiryAcknowledgement: jest.fn(async () => undefined),
    ...overrides.email,
  } as unknown as EmailService;

  const env = {
    resendContactInboxSales: 'sales@ployos.com',
    resendContactInboxPartners: 'partners@ployos.com',
    resendContactInboxPress: 'press@ployos.com',
    resendContactInboxSupport: 'support@ployos.com',
    ...overrides.env,
  } as unknown as EnvironmentsService;

  const ctx = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    ...overrides.ctx,
  } as unknown as RequestContextService;

  return new ContactService(uow, email, env, ctx);
}

describe('ContactService.submit', () => {
  it('persists the inquiry and returns its id', async () => {
    const uow = {
      contactInquiries: {
        insertInquiry: jest.fn(async () => buildInquiry({ id: 'new-id' })),
        markEmailFailure: jest.fn(async () => undefined),
        markEmailSent: jest.fn(async () => undefined),
      },
    };
    const service = makeService({ uow });

    const result = await service.submit({
      name: 'Ada',
      email: 'ada@example.com',
      company: 'Acme',
      topic: 'sales',
      message: 'hello there friend',
    });

    expect(result).toEqual({ id: 'new-id' });
    expect(uow.contactInquiries.insertInquiry).toHaveBeenCalledTimes(1);
  });

  it('dispatches the notification email to the topic-appropriate inbox', async () => {
    const email = {
      sendContactInquiryNotification: jest.fn(async () => undefined),
      sendContactInquiryAcknowledgement: jest.fn(async () => undefined),
    } as unknown as EmailService;
    const service = makeService({ email });

    await service.submit({
      name: 'A',
      email: 'a@b.co',
      company: 'C',
      topic: 'press',
      message: 'enough characters',
    });

    // Allow microtasks for fire-and-forget dispatches.
    await new Promise((r) => setImmediate(r));

    expect(email.sendContactInquiryNotification).toHaveBeenCalledWith(
      'press@ployos.com',
      expect.objectContaining({ topic: 'press', name: 'A' }),
    );
    expect(email.sendContactInquiryAcknowledgement).toHaveBeenCalledWith(
      'a@b.co',
      expect.objectContaining({ name: 'A', topic: 'press' }),
    );
  });

  it('flips email_status to failed_notification when only the notification fails', async () => {
    const markEmailFailure = jest.fn(async (_id: string, _kind: string) => undefined);
    const uow = {
      contactInquiries: {
        insertInquiry: jest.fn(async () => buildInquiry({ id: 'x' })),
        markEmailFailure,
        markEmailSent: jest.fn(async () => undefined),
      },
    };

    const email = {
      sendContactInquiryNotification: jest.fn(async () => {
        throw new Error('resend down');
      }),
      sendContactInquiryAcknowledgement: jest.fn(async () => undefined),
    } as unknown as EmailService;

    const service = makeService({ uow, email });

    await service.submit({
      name: 'A',
      email: 'a@b.co',
      company: 'C',
      topic: 'sales',
      message: 'enough characters',
    });

    await new Promise((r) => setImmediate(r));

    expect(markEmailFailure).toHaveBeenCalledWith('x', 'notification');
  });

  it('returns to the caller without awaiting the email sends', async () => {
    let resolveSend!: () => void;
    const slowSend = new Promise<void>((res) => {
      resolveSend = res;
    });

    const email = {
      sendContactInquiryNotification: jest.fn(() => slowSend),
      sendContactInquiryAcknowledgement: jest.fn(async () => undefined),
    } as unknown as EmailService;

    const service = makeService({ email });

    const result = await Promise.race([
      service.submit({
        name: 'A',
        email: 'a@b.co',
        company: 'C',
        topic: 'other',
        message: 'enough characters',
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('submit blocked on email')), 50),
      ),
    ]);

    expect(result).toEqual({ id: 'inquiry-id' });
    resolveSend();
  });
});
