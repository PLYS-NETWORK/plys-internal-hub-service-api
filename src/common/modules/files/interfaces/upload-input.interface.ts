/**
 * Validated, sanitised payload that `FilesService` hands to a storage
 * provider. The buffer has already passed magic-byte sniffing, the
 * `mimeType` reflects the sniffed value (not the client header), and
 * `originalName` has been NFC-normalised and stripped of unsafe characters.
 */
export interface IUploadInput {
  /** Full byte content of the file. */
  readonly buffer: Buffer;
  /** Sniffed MIME type — never the client-supplied Content-Type. */
  readonly mimeType: string;
  /** Sanitised display name; never used to construct a storage path. */
  readonly originalName: string;
  /** Byte length of `buffer`, repeated for convenience. */
  readonly size: number;
  /** Lowercase file extension WITHOUT the leading dot, derived from the sniffed MIME. */
  readonly extension: string;
}
