import { HttpStatus, Injectable } from '@nestjs/common';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { ListBillsDto } from '../dto/requests/list-bills.dto';
import { TriggerSettlementDto } from '../dto/requests/trigger-settlement.dto';
import {
  BillDetailResponseDto,
  BillInvoiceDetailResponseDto,
} from '../dto/responses/bill-detail-response.dto';
import { BillListResponseDto } from '../dto/responses/bill-list-response.dto';
import { SendBillResponseDto } from '../dto/responses/send-bill-response.dto';
import { IBillingAdminService } from '../interfaces/billing-admin-service.interface';
import { BillingSettlementService } from './billing-settlement.service';

@Injectable()
export class BillingAdminService implements IBillingAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly billingSettlement: BillingSettlementService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BillingAdminService.name, requestContext);
  }

  /** @inheritdoc */
  public async listBills(dto: ListBillsDto): Promise<PageDto<BillListResponseDto>> {
    this.logger.log(`listBills — start | page: ${dto.page}, limit: ${dto.limit}`);

    const [periods, itemCount] = await this.uow.billingPeriods.findWithInvoice(
      dto.skip,
      dto.limit,
      dto.status,
      dto.businessId,
    );

    const data = periods.map((period) => {
      // `invoice` is mapped onto the period via leftJoinAndMapOne (virtual property)
      const inv = (period as unknown as Record<string, unknown>)['invoice'] as
        | Record<string, unknown>
        | null
        | undefined;

      return plainToInstance(
        BillListResponseDto,
        {
          id: period.id,
          business_id: period.businessId,
          period_start: period.periodStart,
          period_end: period.periodEnd,
          status: period.status,
          total_amount: period.totalAmount,
          finalized_at: period.finalizedAt,
          invoice: inv
            ? {
                id: inv['id'],
                amount: inv['amount'],
                currency: inv['currency'],
                status: inv['status'],
                due_date: inv['dueDate'],
                paid_at: inv['paidAt'],
              }
            : null,
        },
        { excludeExtraneousValues: true },
      );
    });

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(`listBills — complete | itemCount: ${itemCount}`);

    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async triggerSettlement(dto: TriggerSettlementDto): Promise<void> {
    this.logger.log(
      `triggerSettlement — start | year: ${dto.year}, month: ${dto.month}${dto.businessId ? `, businessId: ${dto.businessId}` : ''}`,
    );

    // month from API is 1-indexed; runSettlement expects 0-indexed
    await this.billingSettlement.runSettlement(dto.year, dto.month - 1, dto.businessId);

    this.logger.log(`triggerSettlement — complete`);
  }

  /** @inheritdoc */
  public async getBillDetail(invoiceId: string): Promise<BillDetailResponseDto> {
    this.logger.log(`getBillDetail — start | invoiceId: ${invoiceId}`);

    const invoice = await this.uow.invoices.findOne({
      where: { id: invoiceId },
      relations: { billingPeriod: true },
    });

    if (!invoice) {
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_not_found',
        errorCode: ERROR_CODES.BILLING_INVOICE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const lineItems = await this.uow.invoiceLineItems.find({
      where: { invoiceId: invoice.id },
      relations: { task: true, project: true },
    });

    const invoiceDetail = plainToInstance(
      BillInvoiceDetailResponseDto,
      {
        id: invoice.id,
        task_total: invoice.taskTotal,
        commission_rate: invoice.commissionRate,
        commission_amount: invoice.commissionAmount,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        due_date: invoice.dueDate,
        paid_at: invoice.paidAt,
        notified_at: invoice.notifiedAt,
        processor_name: invoice.processorName,
        processor_payment_url: invoice.processorPaymentUrl,
        line_items: lineItems.map((item) => ({
          id: item.id,
          task_id: item.taskId,
          task_title: item.task?.title ?? '',
          project_id: item.projectId,
          project_title: item.project?.title ?? '',
          consultant_id: item.consultantId,
          description: item.description,
          amount: item.amount,
          platform_fee_amount: item.platformFeeAmount,
          consultant_payout: item.consultantPayout,
        })),
      },
      { excludeExtraneousValues: true },
    );

    const period = invoice.billingPeriod;

    this.logger.log(`getBillDetail — complete | invoiceId: ${invoiceId}`);

    return plainToInstance(
      BillDetailResponseDto,
      {
        id: period.id,
        business_id: period.businessId,
        period_start: period.periodStart,
        period_end: period.periodEnd,
        status: period.status,
        total_amount: period.totalAmount,
        finalized_at: period.finalizedAt,
        invoice: invoiceDetail,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async sendBillEmail(invoiceId: string): Promise<SendBillResponseDto> {
    this.logger.log(`sendBillEmail — start | invoiceId: ${invoiceId}`);

    const invoice = await this.uow.invoices.findOne({ where: { id: invoiceId } });

    if (!invoice) {
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_not_found',
        errorCode: ERROR_CODES.BILLING_INVOICE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (invoice.notifiedAt) {
      this.logger.warn(
        `sendBillEmail — re-sending previously notified invoice | invoiceId: ${invoiceId}, previousNotifiedAt: ${invoice.notifiedAt.toISOString()}`,
      );
    }

    await this.billingSettlement.sendInvoiceEmail(invoice);

    // Reload to get the stamped notifiedAt set by sendInvoiceEmail
    const updated = await this.uow.invoices.findOne({ where: { id: invoiceId } });
    const notifiedAt = updated?.notifiedAt ?? DateUtil.nowDate();

    this.logger.log(`sendBillEmail — complete | invoiceId: ${invoiceId}`);

    return plainToInstance(
      SendBillResponseDto,
      { invoice_id: invoiceId, notified_at: notifiedAt },
      { excludeExtraneousValues: true },
    );
  }
}
