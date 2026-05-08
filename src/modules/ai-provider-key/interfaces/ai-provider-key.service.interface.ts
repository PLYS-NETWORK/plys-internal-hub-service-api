import { AiProvider } from '@database/enums';

import { CreateApiKeyDto, UpdateApiKeyDto } from '../dto/requests';
import { ApiKeyAdminResponseDto, ApiKeyBffResponseDto } from '../dto/responses';

export interface IAiProviderKeyService {
  /**
   * Returns the active key for a provider, wrapped in a fresh BFF envelope.
   * The FE BFF decrypts the envelope with FE_BFF_SECRET_v<version> to recover
   * the plaintext API key. Caches in-memory for ~30 min on the BFF side.
   *
   * @param provider Which provider's active key to fetch.
   * @returns Envelope payload (encrypted under the current FE_BFF_SECRET).
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_CONFIGURED if no
   *   active key exists for the provider.
   * @throws TranslatableException 500 AI_PROVIDER_KEY_CIPHER_FAILED if the
   *   row's master ciphertext is unreadable or the BFF secret is missing.
   */
  getActiveKeyEnvelope(provider: AiProvider): Promise<ApiKeyBffResponseDto>;

  /**
   * Lists every key in the vault, masked. Response order: provider asc, then
   * created_at desc.
   * @returns Masked rows for the admin list view.
   */
  list(): Promise<ApiKeyAdminResponseDto[]>;

  /**
   * Creates a new key. Plaintext is encrypted under the current master
   * version, then zeroed from the in-memory DTO. The new key is created
   * inactive — admins must explicitly call `activate(id)`.
   * @param dto Provider/model/label/key payload.
   * @returns Masked admin row for the new record.
   */
  create(dto: CreateApiKeyDto): Promise<ApiKeyAdminResponseDto>;

  /**
   * Updates label/model only. Refuses to mutate the plaintext key — admins
   * must create a new row and activate it instead.
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_FOUND.
   */
  update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyAdminResponseDto>;

  /**
   * Activates this key, deactivating any prior active key for the same
   * provider in one transaction. The partial unique index keeps the
   * "at most one active per provider" invariant safe under races.
   * @throws TranslatableException 404 AI_PROVIDER_KEY_NOT_FOUND.
   */
  activate(id: string): Promise<ApiKeyAdminResponseDto>;

  /**
   * Revokes the key. Refuses if the key is currently active and is the
   * only active key for the provider — admins must activate a replacement
   * first.
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
