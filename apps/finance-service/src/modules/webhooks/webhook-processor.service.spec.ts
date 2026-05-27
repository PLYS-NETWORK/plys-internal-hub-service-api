import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { WebhookEventType } from '@plys/libraries/common-nest/modules/payment/interfaces/webhook-event.interface';
import { PaymentService } from '@plys/libraries/common-nest/modules/payment/payment.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { PaymentProcessor } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';

import { BillingInvoiceService } from '../billing/services/billing-invoice.service';
import { WebhookProcessorService } from './webhook-processor.service';

describe('WebhookProcessorService — Stripe', () => {
  let service: WebhookProcessorService;
  let paymentService: jest.Mocked<Pick<PaymentService, 'constructStripeWebhookEvent'>>;
  let uow: {
    webhookEvents: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
    businessTransactions: { findOne: jest.Mock };
    consultantTransactions: { findOne: jest.Mock };
  };

  beforeEach(async () => {
    paymentService = {
      constructStripeWebhookEvent: jest.fn(),
    };

    uow = {
      webhookEvents: {
        findOne: jest.fn().mockResolvedValue(null as never),
        create: jest.fn((entity) => entity),
        save: jest.fn().mockImplementation(async (entity) => entity),
      },
      businessTransactions: { findOne: jest.fn().mockResolvedValue(null as never) },
      consultantTransactions: { findOne: jest.fn().mockResolvedValue(null as never) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        { provide: UnitOfWorkService, useValue: uow },
        { provide: RequestContextService, useValue: {} },
        { provide: PaymentService, useValue: paymentService },
        {
          provide: BillingInvoiceService,
          useValue: { handleInvoicePaymentSucceeded: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(WebhookProcessorService);
  });

  it('rejects Stripe webhooks when signature verification fails', async () => {
    // Arrange
    paymentService.constructStripeWebhookEvent.mockImplementation(() => {
      throw new UnauthorizedException('Invalid Stripe webhook signature.');
    });

    // Act + Assert
    await expect(
      service.processStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(uow.webhookEvents.save).not.toHaveBeenCalled();
  });

  it('verifies signature before persisting the webhook event', async () => {
    // Arrange
    paymentService.constructStripeWebhookEvent.mockReturnValue({
      type: WebhookEventType.UNKNOWN,
      rawType: 'transfer.failed',
      data: { id: 'tr_123' },
      processorEventId: 'evt_123',
    });

    // Act
    await service.processStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    // Assert
    expect(paymentService.constructStripeWebhookEvent).toHaveBeenCalledWith(expect.any(Buffer), {
      'stripe-signature': 'sig',
    });
    expect(uow.webhookEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        processor: PaymentProcessor.STRIPE,
        eventId: 'evt_123',
        eventType: 'transfer.failed',
      }),
    );
  });
});
