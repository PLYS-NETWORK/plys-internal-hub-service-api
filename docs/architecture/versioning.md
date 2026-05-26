# Versioning `@plys/libraries`

All shared libraries live under `packages/` as subfolders of a single workspace package: **`@plys/libraries`**.

## Single version

Semver is defined once in [`packages/package.json`](../../packages/package.json):

```json
{
  "name": "@plys/libraries",
  "version": "0.2.0"
}
```

There is no per-module `package.json` and no sync script. Bump the version only via [Changesets](https://github.com/changesets/changesets).

## Changesets

The fixed group in [`.changeset/config.json`](../../.changeset/config.json) is:

```json
"fixed": [["@plys/libraries"]]
```

When you run `pnpm changeset`, describe the change and select `@plys/libraries`. Running `pnpm version-packages` updates the single `version` field in `packages/package.json`.

## Adding a new shared module

1. Create a subfolder under `packages/`, e.g. `packages/my-module/`.
2. Add an export entry in `packages/package.json`:

   ```json
   "./my-module": "./my-module/index.ts",
   "./my-module/*": "./my-module/*"
   ```

3. Add a matching TypeScript path in [`tsconfig.base.json`](../../tsconfig.base.json) if needed for Nest/tsc resolution.
4. Import from apps as `@plys/libraries/my-module`.

Do **not** add a nested `package.json`, `project.json`, or `src/` wrapper for the module.

## App dependencies

Apps declare one workspace dependency:

```json
"@plys/libraries": "workspace:*"
```

Import subpaths, for example:

- `@plys/libraries/proto`
- `@plys/libraries/database`
- `@plys/libraries/common-nest/modules/environments`
