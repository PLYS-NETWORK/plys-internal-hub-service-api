/**
 * Injection token for the active `IStorageProvider`. The token is bound at
 * module init by `FilesModule`'s `useFactory`, which selects the provider
 * based on `EnvironmentsService.filesStorageProvider`. `FilesService` and
 * `FilesCleanupService` reference the provider only through this token —
 * they never import a concrete implementation.
 */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
