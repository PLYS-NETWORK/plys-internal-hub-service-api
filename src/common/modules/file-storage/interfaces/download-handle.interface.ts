import { Readable } from 'stream';

/**
 * Result of `IStorageProvider.download(key)`. Cloud providers return a
 * short-lived presigned URL the caller turns into a 302 redirect; the
 * local provider returns a Node `Readable` the caller pipes into the
 * HTTP response. The discriminator lets the controller branch without
 * sniffing the provider type.
 */
export type IDownloadHandle =
  | { readonly kind: 'redirect'; readonly url: string }
  | { readonly kind: 'stream'; readonly stream: Readable };
