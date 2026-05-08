import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { HttpStatus } from '@nestjs/common';
import { Transform } from 'class-transformer';

// Rough but cheap HTML / scheme rejection. The contract for derived AI
// context fields is plain text — these patterns either inject script in a
// downstream renderer (`<script`, `javascript:`, `data:text/html`, event-
// handler attributes) or strongly suggest the FE prompt is misbehaving and
// emitting markup we shouldn't store.
const HTML_REJECTION_PATTERNS: RegExp[] = [
  /<script\b/i,
  /<\/script\s*>/i,
  /\bjavascript\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\son\w+\s*=/i,
];

// C0 + C1 control chars, except the three benign whitespace forms (\t, \n, \r)
// which we keep so multi-paragraph summaries survive a round trip. Hex
// escapes are deliberate — literal control bytes in source files don't
// survive editors / formatters reliably.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

function rejectHtmlMarkers(value: string, fieldLabel: string): void {
  for (const pattern of HTML_REJECTION_PATTERNS) {
    if (pattern.test(value)) {
      const exception = new TranslatableException({
        messageKey: 'error.ai_context.derived_html_forbidden',
        errorCode: ERROR_CODES.AI_CONTEXT_DERIVED_HTML_FORBIDDEN,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        args: { field: fieldLabel },
      });
      // Tag the cause with the matching pattern for logs without leaking it
      // into the user-facing payload.
      (exception as Error & { cause?: unknown }).cause = new Error(
        `${fieldLabel}: rejected by ${pattern.source}`,
      );
      throw exception;
    }
  }
}

export interface SanitizeTextOptions {
  /** Field label surfaced in the cause when an HTML marker is detected. */
  fieldLabel: string;
  /** When true, allow null/undefined to pass through as-is. */
  allowNullable?: boolean;
}

/**
 * Apply to a `@Transform`-decorated string field on a request DTO. Runs (in
 * order):
 *   1. NFC unicode normalisation — collapses combining-character variants so
 *      a stored "café" matches what the FE submitted regardless of which
 *      composition form it picked.
 *   2. Control-character strip — removes invisible bytes that could break
 *      downstream consumers (logs, email renderers) without changing what
 *      the user sees.
 *   3. Outer-whitespace trim — preserves internal newlines, drops leading /
 *      trailing whitespace.
 *   4. Inline-HTML rejection — throws TranslatableException 422 if a script,
 *      `javascript:`, `data:text/html`, or `on…=` event handler is present.
 *
 * Layered with `@Length` (size caps) and DTO `@IsString` (shape check).
 */
export function SanitizeText(options: SanitizeTextOptions): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;

    const normalised = value.normalize('NFC').replace(CONTROL_CHARS_PATTERN, '').trim();
    rejectHtmlMarkers(normalised, options.fieldLabel);
    return normalised;
  });
}
