module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      'tsconfig.json',
      'apps/api-gateway/tsconfig.json',
      'apps/api-gateway/tsconfig.eslint.json',
      'apps/identity-service/tsconfig.json',
      'apps/identity-service/tsconfig.eslint.json',
      'apps/business-service/tsconfig.json',
      'apps/business-service/tsconfig.eslint.json',
      'apps/consultant-service/tsconfig.json',
      'apps/consultant-service/tsconfig.eslint.json',
      'apps/internal-admin-service/tsconfig.json',
      'apps/internal-admin-service/tsconfig.eslint.json',
      'apps/internal-task-reviewer-service/tsconfig.json',
      'apps/internal-task-reviewer-service/tsconfig.eslint.json',
      'apps/finance-service/tsconfig.json',
      'apps/finance-service/tsconfig.eslint.json',
      'apps/notifications-service/tsconfig.json',
      'apps/notifications-service/tsconfig.eslint.json',
      'apps/platform-service/tsconfig.json',
      'apps/platform-service/tsconfig.eslint.json',
      'apps/ai-provider-service/tsconfig.json',
      'apps/ai-provider-service/tsconfig.eslint.json',
      'packages/tsconfig.json',
      'packages/tsconfig.eslint.json',
    ],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'simple-import-sort'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    '.eslintrc.js',
    '**/*.mjs',
    '**/*.cjs',
    'scripts/**',
    'deploy/**',
    '**/tsconfig*.json',
    'ecosystem*.js',
  ],
  overrides: [
    {
      files: ['apps/business-service/**/*.ts', 'apps/consultant-service/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/apps/internal-admin-service/**', '../internal-admin-service/**'],
                message: 'Role services must not import internal-admin-service directly.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/api-gateway/src/http/v1/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/apps/*-service/**'],
                message: 'api-gateway must not import backend apps; use gRPC clients only.',
              },
              {
                group: ['@modules/**'],
                message:
                  'api-gateway must not import @modules/*; use shared contracts and gateway-local DTOs.',
              },
            ],
          },
        ],
      },
    },
  ],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
    ],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
};
