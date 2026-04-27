/**
 * Strategy that resolves "which rows belong to the caller?" — one implementation
 * per platform (business / consultant / admin). Concrete statistics services
 * read from the scope rather than building platform-specific WHERE clauses
 * themselves, so the same aggregation SQL serves every dashboard.
 */
export interface IStatisticsScope {
  /**
   * Returns the project IDs the caller owns (business) / is a member of
   * (consultant) / can see all of (admin).
   *
   * Most aggregation queries take this list and use `WHERE project_id IN (...)`.
   * The scope memoises the result for the duration of one request so multiple
   * services do not repeat the same lookup.
   *
   * @returns Project UUIDs visible to the caller; empty array when none.
   */
  getOwnedProjectIds(): Promise<string[]>;

  /**
   * Resolves and returns the caller's `business_profile.id` (BUSINESS scope).
   * Used by finance queries that filter directly on `business_id` rather than
   * a project IN-clause.
   *
   * @returns The caller's business profile UUID.
   * @throws TranslatableException(BUSINESS_PROFILE_NOT_FOUND) when the caller
   *         is on the BUSINESS platform but has no business profile.
   */
  getBusinessId(): Promise<string>;
}
