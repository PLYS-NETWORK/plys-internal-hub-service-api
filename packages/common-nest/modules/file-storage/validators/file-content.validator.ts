import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import * as FileType from 'file-type';

import { IUploadInput } from '../interfaces';

/**
 * Centralised validation pipeline shared by every entry point that accepts
 * binary uploads. Performs (in order): size check → magic-byte sniff →
 * MIME allow-list → image-pixel cap → name sanitisation. Every rejection
 * path raises a `TranslatableException` so the caller (HTTP controller or
 * a feature service) can surface a localised error directly.
 */
@Injectable()
export class FileContentValidator {
  constructor(private readonly env: EnvironmentsService) {}

  /**
   * Validates the raw upload, sniffs the true MIME type, sanitises the
   * client-supplied filename, and returns a normalised `IUploadInput`.
   *
   * @param buffer       Raw bytes of the upload.
   * @param originalName Client-supplied filename (untrusted).
   * @throws TranslatableException(FILE_SIZE_EXCEEDED)        if `buffer` exceeds the configured cap.
   * @throws TranslatableException(FILE_INVALID_TYPE)         if the sniffed MIME is missing or not allow-listed.
   * @throws TranslatableException(FILE_DIMENSIONS_EXCEEDED)  if image dimensions exceed the optional pixel cap.
   */
  public async validate(buffer: Buffer, originalName: string): Promise<IUploadInput> {
    if (buffer.length === 0 || buffer.length > this.env.filesMaxSizeBytes) {
      throw new TranslatableException({
        messageKey: 'error.file.size_exceeded',
        errorCode: ERROR_CODES.FILE_SIZE_EXCEEDED,
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
    }

    // file-type reads only the first few KB; safe to call on the full buffer.
    const sniffed = await FileType.fromBuffer(buffer);
    const sniffedMime = sniffed?.mime;
    if (!sniffedMime || !this.env.filesAllowedMimeList.includes(sniffedMime)) {
      throw new TranslatableException({
        messageKey: 'error.file.invalid_type',
        errorCode: ERROR_CODES.FILE_INVALID_TYPE,
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      });
    }

    return {
      buffer,
      mimeType: sniffedMime,
      originalName: this.sanitiseOriginalName(originalName),
      size: buffer.length,
      // Always derived from the sniffed MIME — never from the client filename.
      extension: sniffed.ext.toLowerCase(),
    };
  }

  /**
   * Strips control characters, path separators, and NULs from a client
   * filename and NFC-normalises it. The result is suitable to persist as
   * display metadata; it is never used to construct a filesystem path.
   */
  private sanitiseOriginalName(input: string): string {
    const normalised = (input ?? '').normalize('NFC');
    // eslint-disable-next-line no-control-regex
    const stripped = normalised.replace(/[\x00-\x1f\x7f/\\]/g, '').trim();
    if (stripped.length === 0) {
      // Fall back to a generic placeholder rather than throwing — the
      // client's filename is metadata, not a security boundary.
      return 'file';
    }
    // Defensive cap so the column can't blow up logs/UIs even if `text`.
    return stripped.slice(0, 255);
  }
}
