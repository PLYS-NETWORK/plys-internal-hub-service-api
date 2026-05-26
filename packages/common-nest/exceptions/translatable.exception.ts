import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@plys/libraries/common-nest/constants/error-codes';

export interface TranslatableExceptionPayload {
  messageKey: string;
  errorCode: ErrorCode;
  args?: Record<string, string | number>;
  status?: HttpStatus;
  /**
   * Optional structured payload surfaced as `data` in the error response
   * envelope. Use for 4xx errors that need to communicate machine-readable
   * context — e.g. `{ offending_task_ids: [...] }` on a price-gate failure.
   * Stays unset for the common case so the response remains `data: null`.
   */
  details?: Record<string, unknown>;
}

// Carries a translation key instead of a raw string so the GlobalExceptionFilter
// can resolve it against the request's locale at response time.
// Services should throw this for any user-facing error message.
export class TranslatableException extends HttpException {
  public readonly messageKey: string;
  public readonly errorCode: ErrorCode;
  public readonly args?: Record<string, string | number>;
  public readonly details?: Record<string, unknown>;

  constructor(payload: TranslatableExceptionPayload) {
    const status = payload.status ?? HttpStatus.BAD_REQUEST;
    super(
      {
        statusCode: status,
        messageKey: payload.messageKey,
        errorCode: payload.errorCode,
        args: payload.args,
        details: payload.details,
      },
      status,
    );
    this.messageKey = payload.messageKey;
    this.errorCode = payload.errorCode;
    this.args = payload.args;
    this.details = payload.details;
  }
}
