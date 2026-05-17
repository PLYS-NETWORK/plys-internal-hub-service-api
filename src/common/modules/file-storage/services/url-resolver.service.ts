import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_PROVIDER } from '../constants';
import { IStorageProvider } from '../interfaces';
import { IUrlResolverService } from '../interfaces/url-resolver.service.interface';

/**
 * Strategy that turns a persisted asset URL (potentially an expired upload-time
 * S3 presigned URL) into a fresh one before it leaves the API.
 *
 * Background: uploads via `POST /files` return a presigned GET URL signed with
 * `X-Amz-Expires=900` (15 min). Surfaces such as `consultant_profiles.avatar_url`,
 * `consultant_profiles.cv_url`, and `business_profiles.logo_url` persist that
 * upload-time URL verbatim, so reads that happen even a few minutes later see
 * `403 SignatureDoesNotMatch` from S3. Every read path that surfaces one of
 * those columns funnels through this service so the response always carries a
 * URL signed *now* with the full configured presign TTL.
 *
 * The same code path is safe to call for local-provider URLs (no `URL` parse,
 * or no `<bucket>/` prefix) — the original value is returned unchanged so the
 * resolver is a no-op in dev.
 */
@Injectable()
export class UrlResolverService implements IUrlResolverService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(UrlResolverService.name, requestContext);
  }

  /** @inheritdoc */
  public async resolve(raw: string | null | undefined): Promise<string | null> {
    if (!raw) return null;
    const key = this.extractStorageKey(raw);
    if (!key) return raw;
    try {
      return await this.storage.getUrl(key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Re-signing should never block the response — return the stored value
      // and let the caller render a broken image instead of failing the API.
      this.logger.warn(
        `[${this.rid}] resolve — re-sign failed, returning stored value | key: ${key}, error: ${msg}`,
      );
      return raw;
    }
  }

  /** @inheritdoc */
  public async resolveMany(
    raws: ReadonlyArray<string | null | undefined>,
  ): Promise<Array<string | null>> {
    return Promise.all(raws.map((r) => this.resolve(r)));
  }

  /**
   * Extracts the storage key from a stored URL — but only when the URL is
   * clearly addressing the configured S3 bucket. Two recognised shapes:
   *
   *   - Path-style:           `https://<endpoint>/<bucket>/<key>?...`
   *   - Virtual-hosted style: `https://<bucket>.<endpoint>/<key>?...`
   *
   * Returns `null` for anything else (manually-entered CDN URLs, public asset
   * links, local-provider URLs), so the caller leaves the value alone and the
   * resolver is a strict no-op for non-S3 content.
   */
  private extractStorageKey(raw: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    const bucket = this.env.awsS3DefaultBucket;
    if (!bucket) return null;

    const pathname = parsed.pathname.replace(/^\/+/, '');
    // Path-style: pathname starts with "<bucket>/".
    if (pathname.startsWith(`${bucket}/`)) {
      return pathname.slice(bucket.length + 1);
    }
    // Virtual-hosted style: host is "<bucket>.<rest>".
    if (parsed.hostname === bucket || parsed.hostname.startsWith(`${bucket}.`)) {
      return pathname || null;
    }
    return null;
  }
}
