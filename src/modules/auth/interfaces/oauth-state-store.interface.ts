import { ActivePlatform } from '@database/enums';

export interface IOAuthStateRecord {
  readonly activePlatform: ActivePlatform;
  readonly createdAt: string;
}

export interface IOAuthStateStore {
  /**
   * Generates a random nonce, persists the given activePlatform under it in
   * Redis, and returns the nonce. Pass the result to Google as `state`.
   *
   * @param activePlatform - Platform context the user initiated the flow for.
   * @returns Single-use nonce safe to embed in the OAuth `state` parameter.
   */
  issue(activePlatform: ActivePlatform): Promise<string>;

  /**
   * Atomically reads-and-deletes the state record bound to `nonce`.
   *
   * @param nonce - The `state` value Google echoed back on callback.
   * @returns The activePlatform recorded at issue time.
   * @throws TranslatableException (400) — nonce unknown, expired, or already consumed.
   */
  consume(nonce: string): Promise<IOAuthStateRecord>;
}
