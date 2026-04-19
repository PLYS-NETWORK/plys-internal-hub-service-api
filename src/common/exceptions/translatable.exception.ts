import { ErrorCode } from '@common/constants/error-codes';
import { HttpException, HttpStatus } from '@nestjs/common';

export interface TranslatableExceptionPayload {
  messageKey: string;
  errorCode: ErrorCode;
  args?: Record<string, string | number>;
  status?: HttpStatus;
}

// Carries a translation key instead of a raw string so the GlobalExceptionFilter
// can resolve it against the request's locale at response time.
// Services should throw this for any user-facing error message.
export class TranslatableException extends HttpException {
  public readonly messageKey: string;
  public readonly errorCode: ErrorCode;
  public readonly args?: Record<string, string | number>;

  constructor(payload: TranslatableExceptionPayload) {
    const status = payload.status ?? HttpStatus.BAD_REQUEST;
    super(
      {
        statusCode: status,
        messageKey: payload.messageKey,
        errorCode: payload.errorCode,
        args: payload.args,
      },
      status,
    );
    this.messageKey = payload.messageKey;
    this.errorCode = payload.errorCode;
    this.args = payload.args;
  }
}
