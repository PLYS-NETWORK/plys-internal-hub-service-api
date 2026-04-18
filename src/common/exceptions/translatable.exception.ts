import { HttpException, HttpStatus } from '@nestjs/common';

export interface TranslatableExceptionPayload {
  messageKey: string;
  args?: Record<string, string | number>;
  status?: HttpStatus;
}

// Carries a translation key instead of a raw string so the GlobalExceptionFilter
// can resolve it against the request's locale at response time.
// Services should throw this for any user-facing error message.
export class TranslatableException extends HttpException {
  public readonly messageKey: string;
  public readonly args?: Record<string, string | number>;

  constructor(payload: TranslatableExceptionPayload) {
    const status = payload.status ?? HttpStatus.BAD_REQUEST;
    super(
      {
        statusCode: status,
        messageKey: payload.messageKey,
        args: payload.args,
      },
      status,
    );
    this.messageKey = payload.messageKey;
    this.args = payload.args;
  }
}
