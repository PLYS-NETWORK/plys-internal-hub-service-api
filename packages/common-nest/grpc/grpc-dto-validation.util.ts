import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Instantiates and validates a request DTO from a plain JSON object.
 * Mirrors the gateway `I18nValidationPipe` whitelist/forbid rules on the gRPC path.
 */
export async function validateRequestDto<T extends object>(
  plain: Record<string, unknown>,
  dtoClass: ClassConstructor<T>,
): Promise<T> {
  const instance = plainToInstance(dtoClass, plain, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });

  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new TranslatableException({
      messageKey: 'error.generic.bad_request',
      errorCode: ERROR_CODES.GENERIC_BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      details: {
        validation_errors: errors.map((error) => ({
          property: error.property,
          constraints: error.constraints ?? {},
        })),
      },
    });
  }

  return instance;
}
