export interface IRedisService {
  /**
   * Stores a string value at `key`, optionally expiring after `ttlSeconds` seconds.
   *
   * @param key        - Redis key to write.
   * @param value      - String value to store.
   * @param ttlSeconds - Optional TTL in seconds; omit to persist indefinitely.
   * @returns Resolves when the write is acknowledged by Redis.
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Retrieves the string value stored at `key`.
   *
   * @param key - Redis key to read.
   * @returns The stored string, or `null` if the key does not exist or has expired.
   */
  get(key: string): Promise<string | null>;

  /**
   * Deletes the value stored at `key`.
   *
   * @param key - Redis key to remove.
   * @returns Resolves when the delete command is acknowledged; no-op if key does not exist.
   */
  del(key: string): Promise<void>;

  /**
   * Checks whether `key` currently exists in Redis (not expired).
   *
   * @param key - Redis key to test.
   * @returns `true` if the key exists, `false` otherwise.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Updates the TTL of an existing key to `ttlSeconds` seconds from now.
   *
   * @param key        - Redis key to update.
   * @param ttlSeconds - New TTL in seconds.
   * @returns `true` if the timeout was set, `false` if the key does not exist.
   */
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Returns the remaining time-to-live of a key in seconds.
   *
   * @param key - Redis key to inspect.
   * @returns Remaining TTL in seconds; `-1` if no TTL; `-2` if the key does not exist.
   */
  ttl(key: string): Promise<number>;

  /**
   * Increments the integer value stored at `key` by 1, creating it at 0 if absent.
   *
   * @param key - Redis key holding the integer counter.
   * @returns The new value after incrementing.
   */
  incr(key: string): Promise<number>;

  /**
   * Increments the integer value stored at `key` by `increment`, creating it at 0 if absent.
   *
   * @param key       - Redis key holding the integer counter.
   * @param increment - Amount to add; may be negative to decrement.
   * @returns The new value after incrementing.
   */
  incrBy(key: string, increment: number): Promise<number>;

  /**
   * Adds one or more members to the set stored at `key`, creating it if absent.
   *
   * @param key     - Redis key of the set.
   * @param members - One or more string members to add.
   * @returns Number of members actually added (already-present members are not counted).
   */
  sAdd(key: string, ...members: string[]): Promise<number>;

  /**
   * Tests whether `member` belongs to the set stored at `key`.
   *
   * @param key    - Redis key of the set.
   * @param member - Member string to look up.
   * @returns `true` if `member` is in the set, `false` otherwise.
   */
  sIsMember(key: string, member: string): Promise<boolean>;

  /**
   * Removes one or more members from the set stored at `key`.
   *
   * @param key     - Redis key of the set.
   * @param members - One or more member strings to remove.
   * @returns Number of members actually removed (non-existent members are not counted).
   */
  sRem(key: string, ...members: string[]): Promise<number>;

  /**
   * Sets `field` to `value` within the hash stored at `key`, creating the hash if absent.
   *
   * @param key   - Redis key of the hash.
   * @param field - Hash field name to set.
   * @param value - String value to store in the field.
   * @returns Resolves when the write is acknowledged by Redis.
   */
  hSet(key: string, field: string, value: string): Promise<void>;

  /**
   * Retrieves the value of `field` from the hash stored at `key`.
   *
   * @param key   - Redis key of the hash.
   * @param field - Hash field name to read.
   * @returns The field value, or `null` if the key or field does not exist.
   */
  hGet(key: string, field: string): Promise<string | null>;

  /**
   * Retrieves all fields and values of the hash stored at `key`.
   *
   * @param key - Redis key of the hash.
   * @returns A plain object mapping field names to their string values; empty object if key absent.
   */
  hGetAll(key: string): Promise<Record<string, string>>;

  /**
   * Removes one or more fields from the hash stored at `key`.
   *
   * @param key    - Redis key of the hash.
   * @param fields - One or more field names to delete.
   * @returns Number of fields actually removed (non-existent fields are not counted).
   */
  hDel(key: string, ...fields: string[]): Promise<number>;

  /**
   * Returns all keys matching the glob-style `pattern` (e.g. `"session:*"`).
   *
   * Caution: this is a blocking O(N) scan — avoid on large keyspaces in production;
   * prefer `SCAN`-based iteration for hot paths.
   *
   * @param pattern - Glob pattern to match against existing keys.
   * @returns Array of matching key strings; empty array if none match.
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Sets `key` to `value` only if `key` does not already exist (SET NX EX).
   * Atomic — safe to use as a distributed lock primitive.
   *
   * @param key        - Redis key to write.
   * @param value      - String value to store.
   * @param ttlSeconds - Expiry in seconds.
   * @returns `true` if the key was set (lock acquired), `false` if it already existed.
   */
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Sends a PING command to Redis to verify the connection is alive.
   *
   * @returns The string `"PONG"` on a healthy connection.
   * @throws Error if the Redis connection is unavailable.
   */
  ping(): Promise<string>;
}
