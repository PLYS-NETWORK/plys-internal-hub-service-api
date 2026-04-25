import { AuthResponseDto } from '../dto/responses/auth-response.dto';

export interface ISsoCodeStore {
  /**
   * Stores the given auth payload under a freshly-generated random code with
   * a short TTL. The returned code is delivered to the frontend via the
   * OAuth redirect; the frontend POSTs it to `/auth/sso/exchange` to receive
   * the tokens.
   *
   * @param payload - Tokens + user payload to wrap.
   * @returns 32-byte base64url code suitable for use in a redirect URL.
   */
  issue(payload: AuthResponseDto): Promise<string>;

  /**
   * Atomically reads-and-deletes the payload bound to `code`. A second call
   * with the same code always throws.
   *
   * @param code - Single-use code returned by `issue`.
   * @returns The original AuthResponseDto.
   * @throws TranslatableException (401) — code unknown, expired, or already consumed.
   */
  consume(code: string): Promise<AuthResponseDto>;
}
