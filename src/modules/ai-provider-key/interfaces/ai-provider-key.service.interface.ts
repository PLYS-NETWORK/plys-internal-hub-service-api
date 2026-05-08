import { PageDto } from '@common/dto/page.dto';
import { AiAssistantType } from '@database/enums';

import { CreateApiKeyDto, ListApiKeysDto, UpdateApiKeyDto } from '../dto/requests';
import { ApiKeyAdminResponseDto, ApiKeyBffResponseDto } from '../dto/responses';

export interface IAiProviderKeyService {
  /**
   * Returns the active key for an assistant type, wrapped in a fresh BFF
   * envelope. The FE BFF decrypts the envelope with FE_BFF_SECRET_v<version>
   * to recover the plaintext API key. Caches in-memory for ~30 min on the
   * BFF side.
   *
   * @param assistantType Which assistant feature's active key to fetch.
   * @returns Envelope payload (encrypted under the current FE_BFF_SECRET).
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_CONFIGURED if no
   *   active key exists for the assistant type.
   * @throws TranslatableException 500 AI_PROVIDER_KEY_CIPHER_FAILED if the
   *   row's master ciphertext is unreadable or the BFF secret is missing.
   */
  getActiveKeyEnvelope(assistantType: AiAssistantType): Promise<ApiKeyBffResponseDto>;

  /**
   * Lists keys in the vault, masked, paginated. Optional filters narrow by
   * `assistant_type`, exact `model`, or a case-insensitive substring on
   * `label` (`keywords`). Active keys are always sorted ahead of inactive
   * ones so page 1 surfaces the rows currently in rotation; the secondary
   * order is `assistant_type ASC, created_at DESC`.
   * @param dto Pagination + filter options. Defaults: page 1, limit 20.
   * @returns Page of masked rows + meta.
   */
  list(dto: ListApiKeysDto): Promise<PageDto<ApiKeyAdminResponseDto>>;

  /**
   * Creates a new key and activates it in a single transaction. Plaintext
   * is encrypted under the current master version, then zeroed from the
   * in-memory DTO. Any previously active key for the same assistant_type
   * is set to `is_active = false` in the same transaction so the BFF
   * never observes zero or two active keys for that assistant_type.
   * @param dto Assistant-type/provider/model/label/key payload.
   * @returns Masked admin row for the new record (with `is_active = true`).
   */
  create(dto: CreateApiKeyDto): Promise<ApiKeyAdminResponseDto>;

  /**
   * Updates label/model only. Refuses to mutate the plaintext key, the
   * assistant type, or the provider — admins must create a new row and
   * activate it instead.
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_FOUND.
   */
  update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyAdminResponseDto>;

  /**
   * Activates this key, deactivating any prior active key for the same
   * assistant type in one transaction. The partial unique index keeps the
   * "at most one active per assistant_type" invariant safe under races.
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_FOUND.
   */
  activate(id: string): Promise<ApiKeyAdminResponseDto>;

  /**
   * Revokes the key. Refuses if the key is currently active and is the
   * only active key for the assistant type — admins must activate a
   * replacement first.
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_FOUND.
   * @throws TranslatableException 409 AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT.
   */
  revoke(id: string): Promise<void>;

  /**
   * Re-encrypts every row that doesn't reference the current master key
   * version. Idempotent — rows already on the current version are skipped.
   * Run after an `AI_KEYS_MASTER_KEY` rotation to retire the old version.
   * @returns Count of rows that were re-encrypted.
   */
  reEncryptAll(): Promise<number>;
}
