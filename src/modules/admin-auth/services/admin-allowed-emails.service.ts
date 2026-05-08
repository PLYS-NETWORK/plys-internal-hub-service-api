import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { Order } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { AdminAllowedEmail, User } from '@database/entities';
import { ActivePlatform } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SelectQueryBuilder } from 'typeorm';

import { InviteAdminEmailDto } from '../dto/requests/invite-admin-email.dto';
import {
  AdminAllowedEmailSortable,
  ListAdminAllowedEmailsDto,
} from '../dto/requests/list-admin-allowed-emails.dto';
import { AdminAllowedEmailResponseDto } from '../dto/responses/admin-allowed-email-response.dto';
import { IAdminAllowedEmailsService } from '../interfaces/admin-allowed-emails-service.interface';

// Maps the public `sort_by` token to the entity column expression used in
// ORDER BY. Whitelisted up-front so a user-supplied value never reaches SQL.
const SORT_COLUMN_MAP: Record<AdminAllowedEmailSortable, string> = {
  created_at: 'ae.created_at',
  email: 'ae.email',
};

@Injectable()
export class AdminAllowedEmailsService implements IAdminAllowedEmailsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
  ) {
    this.logger = new AppLogger(AdminAllowedEmailsService.name, requestContext);
  }

  /** @inheritdoc */
  public async invite(dto: InviteAdminEmailDto): Promise<AdminAllowedEmailResponseDto> {
    const email = dto.email.trim().toLowerCase();
    this.logger.log(`invite — start | email: ${this.maskEmail(email)}`);

    const existing = await this.uow.adminAllowedEmails.findByEmail(email);
    if (existing) {
      if (existing.isActive) {
        this.logger.warn(`invite — email already on allow-list | email: ${this.maskEmail(email)}`);
        throw new TranslatableException({
          messageKey: 'error.admin.allowed_email_already_exists',
          errorCode: ERROR_CODES.ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS,
          status: HttpStatus.CONFLICT,
        });
      }
      this.logger.warn(`invite — email previously revoked | email: ${this.maskEmail(email)}`);
      throw new TranslatableException({
        messageKey: 'error.admin.allowed_email_revoked',
        errorCode: ERROR_CODES.ADMIN_ALLOWED_EMAIL_REVOKED,
        status: HttpStatus.CONFLICT,
      });
    }

    const invitedByEmail = this.requestContext.email ?? undefined;
    const createdBy = this.requestContext.userId ?? null;

    // Atomic create + send. If the provider rejects the email, the row
    // insert is rolled back so a retry isn't blocked by a half-created row.
    const saved = await this.uow.withTransaction(async (tx) => {
      const row = await tx.adminAllowedEmails.save(
        tx.adminAllowedEmails.create({
          email,
          isActive: true,
          createdBy,
        }),
      );
      await this.emailService.sendAdminInviteEmail(email, {
        internalHubUrl: this.env.internalHubUrl,
        invitedByEmail,
      });
      return row;
    });

    this.logger.log(`invite — complete | id: ${saved.id}, email: ${this.maskEmail(email)}`);
    return this.toResponseDto(saved, null);
  }

  /** @inheritdoc */
  public async list(
    filters: ListAdminAllowedEmailsDto,
  ): Promise<PageDto<AdminAllowedEmailResponseDto>> {
    this.logger.log(
      `list — start | page: ${filters.page}, limit: ${filters.limit}, ` +
        `is_active: ${filters.isActive ?? '<any>'}, keywords: ${filters.keywords ?? '<none>'}`,
    );

    const sortKey: AdminAllowedEmailSortable = filters.sort_by ?? 'created_at';
    const direction: Order = filters.order_by ?? Order.DESC;

    // Manual join: there is no FK between `admin_allowed_emails` and `users`,
    // so we relate by lower-cased email + admin platform. Soft-deleted users
    // are excluded so a tombstoned account doesn't leak its `last_login_at`.
    const buildBaseQuery = (): SelectQueryBuilder<AdminAllowedEmail> =>
      this.uow.adminAllowedEmails
        .createQueryBuilder('ae')
        .leftJoin(
          User,
          'u',
          'LOWER(u.email) = LOWER(ae.email) AND u.platform = :platform AND u.deleted_at IS NULL',
          { platform: ActivePlatform.ADMIN_PLATFORM },
        );

    const dataQb = buildBaseQuery().addSelect('u.last_login_at', 'last_login_at');
    const countQb = buildBaseQuery();

    if (filters.isActive !== undefined) {
      dataQb.andWhere('ae.is_active = :ia', { ia: filters.isActive });
      countQb.andWhere('ae.is_active = :ia', { ia: filters.isActive });
    }
    if (filters.keywords) {
      dataQb.andWhere('LOWER(ae.email) LIKE LOWER(:kw)', { kw: `%${filters.keywords}%` });
      countQb.andWhere('LOWER(ae.email) LIKE LOWER(:kw)', { kw: `%${filters.keywords}%` });
    }

    const itemCount = await countQb.getCount();

    const { entities, raw } = await dataQb
      .orderBy(SORT_COLUMN_MAP[sortKey], direction)
      // Tie-break on id so successive pages stay stable when the chosen
      // sort key has duplicates.
      .addOrderBy('ae.id', 'ASC')
      .skip(filters.skip)
      .take(filters.limit)
      .getRawAndEntities();

    const data = entities.map((row, i) => {
      const lastLoginRaw = (raw[i] as Record<string, unknown>)['last_login_at'];
      const lastLogin = lastLoginRaw instanceof Date ? lastLoginRaw : null;
      return this.toResponseDto(row, lastLogin);
    });

    const meta = new PageMetaDto({ pageOptionsDto: filters, itemCount });

    this.logger.log(`list — complete | returned: ${data.length}, total: ${itemCount}`);
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async setActive(id: string, value: boolean): Promise<void> {
    this.logger.log(`setActive — start | id: ${id}, value: ${value}`);
    const target = await this.uow.adminAllowedEmails.findById(id);
    if (!target) {
      this.logger.warn(`setActive — row not found | id: ${id}`);
      throw new TranslatableException({
        messageKey: 'error.admin.allowed_email_not_found',
        errorCode: ERROR_CODES.ADMIN_ALLOWED_EMAIL_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const requesterEmail = this.requestContext.email;
    if (requesterEmail && target.email.toLowerCase() === requesterEmail.toLowerCase()) {
      this.logger.warn(`setActive — self-toggle blocked | id: ${id}`);
      throw new TranslatableException({
        messageKey: 'error.admin.allowed_email_cannot_revoke_self',
        errorCode: ERROR_CODES.ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF,
        status: HttpStatus.FORBIDDEN,
      });
    }

    target.isActive = value;
    await this.uow.adminAllowedEmails.save(target);
    this.logger.log(`setActive — complete | id: ${id}, value: ${value}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private toResponseDto(
    row: AdminAllowedEmail,
    lastLogin: Date | null,
  ): AdminAllowedEmailResponseDto {
    return plainToInstance(
      AdminAllowedEmailResponseDto,
      {
        id: row.id,
        email: row.email,
        is_active: row.isActive,
        created_at: row.createdAt,
        last_login: lastLogin,
      },
      { excludeExtraneousValues: true },
    );
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 3)}***@${domain}`;
  }
}
