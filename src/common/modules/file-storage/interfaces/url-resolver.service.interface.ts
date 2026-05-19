/**
 * Contract for the URL-resolution strategy. Turns a persisted asset URL into a
 * fresh, signed URL valid for the configured presign TTL. Pass-through for
 * non-S3 values so the same call site works against the local provider.
 */
export interface IUrlResolverService {
  /**
   * Returns a fresh URL for a single stored asset. `null` / `undefined` inputs
   * resolve to `null` so a caller can pipe nullable profile columns through
   * without a pre-check. When the input is not a parseable URL (local provider,
   * non-URL value) the original string is returned unchanged.
   *
   * @param raw - The value stored on the entity (presigned URL, public URL, or null).
   * @returns A freshly presigned URL on success, the original value on failure
   *          or non-S3 input, and `null` for empty inputs.
   */
  resolve(raw: string | null | undefined): Promise<string | null>;

  /**
   * Batched variant — re-signs every input in parallel and preserves order.
   *
   * @param raws - The values stored on each entity row.
   * @returns Array of resolved URLs aligned 1:1 with the input.
   */
  resolveMany(raws: ReadonlyArray<string | null | undefined>): Promise<Array<string | null>>;
}
