import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { FileStorageProvider } from '@plys/libraries/database/enums';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { IDownloadHandle, IStorageProvider, IStoredObject, IUploadInput } from '../interfaces';

/**
 * Filesystem-backed storage provider intended for local development and
 * single-host deployments. All write paths defend against path-traversal,
 * symlink escape, and accidental overwrites; bytes are served by the
 * Fastify @fastify/static plugin under `FILES_LOCAL_PUBLIC_BASE_URL`.
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider, OnModuleInit {
  public readonly name = FileStorageProvider.LOCAL;

  private readonly logger: AppLogger;
  // Resolved on bootstrap: real (symlink-followed) absolute path of the
  // upload root. All write/read paths are checked to live underneath this.
  private resolvedRoot!: string;

  constructor(
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(LocalStorageProvider.name, requestContext);
  }

  public async onModuleInit(): Promise<void> {
    const root = path.resolve(this.env.filesLocalPath);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });

    // Reject if the upload root itself is a symlink — defends against an
    // operator pointing FILES_LOCAL_PATH at a link that escapes the deploy.
    const lstat = await fs.lstat(root);
    if (lstat.isSymbolicLink()) {
      throw new Error(
        `LocalStorageProvider: FILES_LOCAL_PATH (${root}) is a symlink; refusing to start.`,
      );
    }
    this.resolvedRoot = await fs.realpath(root);
    this.logger.log(`onModuleInit — ready | root: ${this.resolvedRoot}`);
  }

  /** @inheritdoc */
  public async put(input: IUploadInput, keyHint: string): Promise<IStoredObject> {
    const targetAbs = this.resolveSafePath(keyHint);

    try {
      await fs.mkdir(path.dirname(targetAbs), { recursive: true, mode: 0o700 });

      // O_WRONLY | O_CREAT | O_EXCL — fail if anything already exists at
      // the path. Combined with the UUID-based keyHint this makes
      // accidental overwrite or symlink-pointed write impossible.
      const handle = await fs.open(targetAbs, 'wx', 0o600);
      try {
        await handle.writeFile(input.buffer);
      } finally {
        await handle.close();
      }

      // Re-resolve after write to catch any race where the parent dir
      // contains a symlink. If the realpath escapes the root, unlink and
      // refuse the upload.
      const writtenReal = await fs.realpath(targetAbs);
      if (!this.isInsideRoot(writtenReal)) {
        await fs.unlink(targetAbs).catch(() => undefined);
        throw new Error(`Resolved write path escapes upload root: ${writtenReal}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`put — failed | key: ${keyHint}, error: ${msg}`);
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    return {
      key: keyHint,
      url: this.buildPublicUrl(keyHint),
    };
  }

  /** @inheritdoc */
  public async getUrl(key: string): Promise<string> {
    // Stable URL — no signing on the local provider. Validate the key
    // shape so a malicious caller can't produce a URL that points outside
    // the public root.
    void this.resolveSafePath(key);
    return this.buildPublicUrl(key);
  }

  /** @inheritdoc */
  public async download(key: string): Promise<IDownloadHandle> {
    const targetAbs = this.resolveSafePath(key);
    // stat first so a missing object surfaces a typed FILE_NOT_FOUND instead
    // of a half-opened stream emitting ENOENT mid-response.
    try {
      await fs.stat(targetAbs);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this.logger.warn(`download — bytes missing on disk | key: ${key}`);
        throw new TranslatableException({
          messageKey: 'error.file.not_found',
          errorCode: ERROR_CODES.FILE_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      this.logger.error(`download — stat failed | key: ${key}, error: ${(err as Error).message}`);
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
    return { kind: 'stream', stream: createReadStream(targetAbs) };
  }

  /** @inheritdoc */
  public async remove(key: string): Promise<void> {
    let targetAbs: string;
    try {
      targetAbs = this.resolveSafePath(key);
    } catch {
      // A key that no longer resolves cleanly (e.g. legacy/migrated row)
      // is treated as already gone — keeps the cleanup cron idempotent.
      this.logger.warn(`remove — key did not resolve under root | key: ${key}`);
      return;
    }
    try {
      await fs.unlink(targetAbs);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // Bytes already gone — idempotent success.
        return;
      }
      this.logger.error(`remove — failed | key: ${key}, error: ${(err as Error).message}`);
      throw new TranslatableException({
        messageKey: 'error.file.delete_failed',
        errorCode: ERROR_CODES.FILE_DELETE_FAILED,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  // ─── Path safety helpers ─────────────────────────────────────────────────

  /**
   * Joins `key` to the resolved upload root and asserts the result stays
   * inside the root. Defends against `..` segments and absolute-path keys.
   */
  private resolveSafePath(key: string): string {
    if (!key || key.length === 0) {
      throw new Error('LocalStorageProvider: empty key');
    }
    // Reject absolute keys outright.
    if (path.isAbsolute(key)) {
      throw new Error(`LocalStorageProvider: absolute key rejected: ${key}`);
    }
    const candidate = path.resolve(this.resolvedRoot, key);
    if (!this.isInsideRoot(candidate)) {
      throw new Error(`LocalStorageProvider: key escapes upload root: ${key}`);
    }
    return candidate;
  }

  private isInsideRoot(absPath: string): boolean {
    const rootWithSep = this.resolvedRoot.endsWith(path.sep)
      ? this.resolvedRoot
      : this.resolvedRoot + path.sep;
    return absPath === this.resolvedRoot || absPath.startsWith(rootWithSep);
  }

  private buildPublicUrl(key: string): string {
    // `posix.join` so URLs always use forward slashes regardless of host OS.
    const relUrl = key.split(path.sep).join('/');
    const base = this.env.filesLocalPublicBaseUrl.replace(/\/+$/, '');
    return `${base}/${relUrl}`;
  }
}
