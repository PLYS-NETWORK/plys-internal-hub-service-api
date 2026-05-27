import { Transform } from 'class-transformer';

import { RequestContextService } from '../modules/request-context/request-context.service';
import { DateInput, DateUtil } from '../utils/date';

const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * Format a date column in the response DTO using the caller's timezone
 * (resolved from the `x-timezone` request header via RequestContextService).
 *
 * Why a decorator: timezone is a per-request value that lives in
 * AsyncLocalStorage. Centralising the lookup here removes the foot-gun of
 * forgetting to format inside one of many service mappers and keeps the
 * service layer focused on shape, not presentation.
 *
 * @param format dayjs format string. Defaults to `YYYY-MM-DD HH:mm:ss`.
 *               Pass `'YYYY-MM-DD'` for date-only fields.
 */
export function TimezoneDate(format: string = DEFAULT_FORMAT): PropertyDecorator {
  return Transform(
    ({ value }: { value: DateInput | null | undefined }) => {
      if (value === null || value === undefined) return null;
      const tz = RequestContextService.currentTimezone();
      return DateUtil.format(value, format, tz);
    },
    { toPlainOnly: true },
  );
}
