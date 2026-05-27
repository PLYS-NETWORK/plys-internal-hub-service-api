import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '@plys/libraries/common-nest/constants/error-codes';
import { QueryFailedError } from 'typeorm';

export interface IPostgresErrorMapping {
  readonly status: number;
  readonly messageKey: string;
  readonly errorCode: ErrorCode;
}

export function mapPostgresError(exception: QueryFailedError): IPostgresErrorMapping {
  const driverError = exception.driverError as { code?: string; message?: string };

  switch (driverError?.code) {
    case '23505':
      return {
        status: HttpStatus.CONFLICT,
        messageKey: 'error.database.unique_violation',
        errorCode: ERROR_CODES.DATABASE_UNIQUE_VIOLATION,
      };
    case '23503':
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        messageKey: 'error.database.foreign_key_violation',
        errorCode: ERROR_CODES.DATABASE_FOREIGN_KEY_VIOLATION,
      };
    case '23502':
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        messageKey: 'error.database.not_null_violation',
        errorCode: ERROR_CODES.DATABASE_NOT_NULL_VIOLATION,
      };
    case 'P0001': {
      const triggerMessage = driverError?.message ?? '';
      if (/project.*status/i.test(triggerMessage)) {
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          messageKey: 'error.project.invalid_status_transition',
          errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
        };
      }
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        messageKey: 'error.generic.bad_request',
        errorCode: ERROR_CODES.GENERIC_BAD_REQUEST,
      };
    }
    default:
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        messageKey: 'error.generic.bad_request',
        errorCode: ERROR_CODES.GENERIC_BAD_REQUEST,
      };
  }
}
