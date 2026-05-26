import { ConsultantActionItemsResponseDto } from '../../../dto/responses/consultant-action-items-response.dto';

/**
 * Contract for the consultant "needs attention" surface. Returns the top-N
 * items per category plus the full category total for each.
 */
export interface IConsultantActionItemsService {
  /**
   * Resolves the caller via `RequestContextService.userId`, fans out the
   * category queries in parallel, caches the resulting payload for 30 s
   * under a per-consultant key.
   * @throws TranslatableException (403) — `CONSULTANT_PROFILE_NOT_FOUND`.
   */
  get(): Promise<ConsultantActionItemsResponseDto>;
}
