import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { AiProviderApiKey } from '@plys/libraries/database/entities';
import { AiAssistantType, AiProvider } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { ILike } from 'typeorm';

import { BffEnvelopeCipher } from './crypto/bff-envelope.cipher';
import { MasterKeyCipher } from './crypto/master-key.cipher';
import { CreateApiKeyDto, ListApiKeysDto, UpdateApiKeyDto } from './dto/requests';
import { ApiKeyAdminResponseDto, ApiKeyBffResponseDto } from './dto/responses';
import { IAiProviderKeyService } from './interfaces/ai-provider-key.service.interface';

// Bounds the FE BFF's in-memory plaintext cache. After this window the BFF
// re-fetches, which means a `FE_BFF_SECRET` rotation propagates within the
// TTL across all BFF replicas.
const BFF_ENVELOPE_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AiProviderKeyService implements IAiProviderKeyService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly masterCipher: MasterKeyCipher,
    private readonly bffCipher: BffEnvelopeCipher,
  ) {
    this.logger = new AppLogger(AiProviderKeyService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async getActiveKeyEnvelope(assistantType: AiAssistantType): Promise<ApiKeyBffResponseDto> {
    this.logger.log(
      `[${this.rid}] getActiveKeyEnvelope — start | assistant_type: ${assistantType}`,
    );

    const row = await this.uow.aiProviderApiKeys.findOne({
      where: { assistantType, isActive: true },
    });
    if (!row) {
      this.logger.warn(
        `[${this.rid}] getActiveKeyEnvelope — not configured | assistant_type: ${assistantType}`,
      );
      throw new TranslatableException({
        messageKey: 'error.ai_provider_key.not_configured',
        errorCode: ERROR_CODES.AI_PROVIDER_KEY_NOT_CONFIGURED,
        status: HttpStatus.NOT_FOUND,
      });
    }

    let plaintext: string;
    try {
      plaintext = this.masterCipher.decrypt(row.keyCiphertext);
    } catch (err) {
      this.logger.error(
        `[${this.rid}] getActiveKeyEnvelope — failed | assistant_type: ${assistantType}, ` +
          `provider: ${row.provider}, key_last4: ${row.keyLast4}, ` +
          `error: ${(err as Error).message}`,
      );
      throw err;
    }

    let envelope;
    try {
      envelope = this.bffCipher.encrypt(plaintext);
    } finally {
      // Best-effort overwrite of the plaintext copy on this stack. Doesn't
      // erase any V8-internal copies, but reduces surface for accidental
      // logging or heap dumps.
      plaintext = '\0'.repeat(plaintext.length);
    }

    const expiresAt = new Date(Date.now() + BFF_ENVELOPE_TTL_MS).toISOString();
    this.logger.log(
      `[${this.rid}] getActiveKeyEnvelope — complete | assistant_type: ${assistantType}, ` +
        `provider: ${row.provider}, label: ${row.label}, key_last4: ${row.keyLast4}, ` +
        `master_v: ${row.masterKeyVersion}, bff_v: ${envelope.version}`,
    );

    return plainToInstance(
      ApiKeyBffResponseDto,
      {
        provider: row.provider,
        model: row.model,
        key_envelope: envelope,
        key_last4: row.keyLast4,
        expires_at: expiresAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async list(dto: ListApiKeysDto): Promise<PageDto<ApiKeyAdminResponseDto>> {
    this.logger.log(
      `[${this.rid}] list — start | page: ${dto.page}, limit: ${dto.limit}, ` +
        `assistant_type: ${dto.assistantType ?? '<any>'}, model: ${dto.model ?? '<any>'}, ` +
        `keywords: ${dto.keywords ?? '<none>'}`,
    );

    const where: Record<string, unknown> = {};
    if (dto.assistantType) where.assistantType = dto.assistantType;
    if (dto.model) where.model = dto.model;
    if (dto.keywords) where.label = ILike(`%${dto.keywords}%`);

    // Active keys are pinned to the top so page 1 surfaces what's currently
    // in rotation. Within active/inactive groups, fall back to assistant_type
    // (so the three feature keys cluster) then created_at desc (newest first).
    const [rows, itemCount] = await this.uow.aiProviderApiKeys.findAndCount({
      where,
      order: { isActive: 'DESC', assistantType: 'ASC', createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const data = rows.map((row) => this.toAdminDto(row));
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `[${this.rid}] list — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async create(dto: CreateApiKeyDto): Promise<ApiKeyAdminResponseDto> {
    this.logger.log(
      `[${this.rid}] create — start | assistant_type: ${dto.assistantType}, ` +
        `provider: ${dto.provider}, label: ${dto.label}`,
    );

    const userId = this.requireUserId();
    const last4 = dto.key.slice(-4).padStart(4, '*');

    let encrypted: { ciphertext: string; version: number };
    try {
      encrypted = this.masterCipher.encrypt(dto.key);
    } catch (err) {
      this.logger.error(`[${this.rid}] create — failed | error: ${(err as Error).message}`);
      throw err;
    }

    // Create-as-active: rotating a key is a one-step operation, so the new
    // row lands `is_active = true` and any previously active key for the
    // same assistant_type is flipped to inactive in the same transaction.
    // The partial unique index uq_ai_provider_api_key_active_per_assistant_type
    // would raise on a race, but doing this in the same tx keeps the
    // window closed.
    const row = await this.uow.withTransaction(async (tx) => {
      await tx.aiProviderApiKeys.update(
        { assistantType: dto.assistantType, isActive: true },
        { isActive: false },
      );
      return tx.aiProviderApiKeys.save(
        tx.aiProviderApiKeys.create({
          assistantType: dto.assistantType,
          provider: dto.provider,
          model: dto.model,
          label: dto.label,
          masterKeyVersion: encrypted.version,
          keyCiphertext: encrypted.ciphertext,
          keyLast4: last4,
          isActive: true,
          createdBy: userId,
        }),
      );
    });

    this.logger.log(
      `[${this.rid}] create — complete | id: ${row.id}, assistant_type: ${row.assistantType}, ` +
        `provider: ${row.provider}, key_last4: ${row.keyLast4}, is_active: true`,
    );
    return this.toAdminDto(row);
  }

  /** @inheritdoc */
  public async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyAdminResponseDto> {
    this.logger.log(`[${this.rid}] update — start | id: ${id}`);

    const row = await this.findOneOrThrow(id);
    if (dto.label !== undefined) row.label = dto.label;
    if (dto.model !== undefined) row.model = dto.model;
    const saved = await this.uow.aiProviderApiKeys.save(row);

    this.logger.log(`[${this.rid}] update — complete | id: ${saved.id}`);
    return this.toAdminDto(saved);
  }

  /** @inheritdoc */
  public async activate(id: string): Promise<ApiKeyAdminResponseDto> {
    this.logger.log(`[${this.rid}] activate — start | id: ${id}`);

    const activated = await this.uow.withTransaction(async (tx) => {
      const target = await tx.aiProviderApiKeys.findOne({ where: { id } });
      if (!target) {
        this.logger.warn(`[${this.rid}] activate — not found | id: ${id}`);
        throw new TranslatableException({
          messageKey: 'error.ai_provider_key.not_found',
          errorCode: ERROR_CODES.AI_PROVIDER_KEY_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Deactivate any prior active key for the same assistant_type; the
      // partial unique index uq_ai_provider_api_key_active_per_assistant_type
      // would raise on a race, but doing this in the same tx keeps the
      // window closed.
      await tx.aiProviderApiKeys.update(
        { assistantType: target.assistantType, isActive: true },
        { isActive: false },
      );
      target.isActive = true;
      return tx.aiProviderApiKeys.save(target);
    });

    this.logger.log(
      `[${this.rid}] activate — complete | id: ${activated.id}, ` +
        `assistant_type: ${activated.assistantType}, provider: ${activated.provider}`,
    );
    return this.toAdminDto(activated);
  }

  /** @inheritdoc */
  public async revoke(id: string): Promise<void> {
    this.logger.log(`[${this.rid}] revoke — start | id: ${id}`);

    await this.uow.withTransaction(async (tx) => {
      const target = await tx.aiProviderApiKeys.findOne({ where: { id } });
      if (!target) {
        this.logger.warn(`[${this.rid}] revoke — not found | id: ${id}`);
        throw new TranslatableException({
          messageKey: 'error.ai_provider_key.not_found',
          errorCode: ERROR_CODES.AI_PROVIDER_KEY_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      // Refuse if revoking the last active key for the assistant_type —
      // admin must roll a replacement to keep that assistant feature alive.
      if (target.isActive) {
        const otherCount = await tx.aiProviderApiKeys.count({
          where: { assistantType: target.assistantType, isActive: false },
        });
        if (otherCount === 0) {
          this.logger.warn(
            `[${this.rid}] revoke — refused (no replacement) | id: ${id}, ` +
              `assistant_type: ${target.assistantType}`,
          );
          throw new TranslatableException({
            messageKey: 'error.ai_provider_key.active_requires_replacement',
            errorCode: ERROR_CODES.AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT,
            status: HttpStatus.CONFLICT,
          });
        }
      }
      await tx.aiProviderApiKeys.delete({ id: target.id });
    });

    this.logger.log(`[${this.rid}] revoke — complete | id: ${id}`);
  }

  /** @inheritdoc */
  public async reEncryptAll(): Promise<number> {
    this.logger.log(`[${this.rid}] reEncryptAll — start`);
    const targetVersion = this.masterCipher.getCurrentVersion();

    let touched = 0;
    await this.uow.withTransaction(async (tx) => {
      const rows = await tx.aiProviderApiKeys.find();
      for (const row of rows) {
        if (row.masterKeyVersion === targetVersion) continue;
        let plaintext: string;
        try {
          plaintext = this.masterCipher.decrypt(row.keyCiphertext);
        } catch (err) {
          // Don't continue silently — a bad row blocks rotation deliberately.
          this.logger.error(
            `[${this.rid}] reEncryptAll — failed | id: ${row.id}, error: ${(err as Error).message}`,
          );
          throw err;
        }
        try {
          const encrypted = this.masterCipher.encrypt(plaintext);
          row.masterKeyVersion = encrypted.version;
          row.keyCiphertext = encrypted.ciphertext;
        } finally {
          plaintext = '\0'.repeat(plaintext.length);
        }
        await tx.aiProviderApiKeys.save(row);
        touched += 1;
      }
    });

    this.logger.log(`[${this.rid}] reEncryptAll — complete | touched: ${touched}`);
    return touched;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findOneOrThrow(id: string): Promise<AiProviderApiKey> {
    const row = await this.uow.aiProviderApiKeys.findOne({ where: { id } });
    if (!row) {
      throw new TranslatableException({
        messageKey: 'error.ai_provider_key.not_found',
        errorCode: ERROR_CODES.AI_PROVIDER_KEY_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return row;
  }

  private requireUserId(): string {
    const userId = this.requestContext.userId;
    if (!userId) {
      // Should be unreachable: admin endpoints are guarded by JwtAuthGuard +
      // RolesGuard before reaching the service.
      throw new TranslatableException({
        messageKey: 'error.generic.unauthorized',
        errorCode: ERROR_CODES.GENERIC_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    return userId;
  }

  private toAdminDto(row: AiProviderApiKey): ApiKeyAdminResponseDto {
    return plainToInstance(
      ApiKeyAdminResponseDto,
      {
        id: row.id,
        assistant_type: row.assistantType,
        provider: row.provider,
        model: row.model,
        label: row.label,
        master_key_version: row.masterKeyVersion,
        key_masked: this.formatMasked(row.provider, row.keyLast4),
        is_active: row.isActive,
        created_by: row.createdBy,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private formatMasked(provider: AiProvider, last4: string): string {
    // Provider-aware prefix where conventional ('gsk_' for Groq, 'sk-' for
    // OpenAI). Otherwise just the masked stem; keeps the field readable
    // without revealing format details for unknown providers.
    const prefix =
      provider === AiProvider.GROQ ? 'gsk_' : provider === AiProvider.OPENAI ? 'sk-' : '';
    return `${prefix}***...${last4}`;
  }
}
