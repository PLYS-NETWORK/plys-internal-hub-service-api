module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      'tsconfig.json',
      'apps/api-gateway/tsconfig.json',
      'apps/identity-service/tsconfig.json',
      'apps/profiles-service/tsconfig.json',
      'apps/projects-service/tsconfig.json',
      'apps/finance-service/tsconfig.json',
      'apps/platform-service/tsconfig.json',
      'packages/tsconfig.json',
      'packages/tsconfig.eslint.json',
    ],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'simple-import-sort'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  overrides: [
    {
      files: ['apps/profiles-service/**/*.ts'],
      parserOptions: {
        project: ['apps/profiles-service/tsconfig.json'],
      },
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/apps/projects-service/**', '../projects-service/**'],
                message:
                  'profiles-service must not import from projects-service; use @plys/libraries instead.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/projects-service/**/*.ts'],
      parserOptions: {
        project: ['apps/projects-service/tsconfig.json'],
      },
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/apps/profiles-service/**', '../profiles-service/**'],
                message:
                  'projects-service must not import from profiles-service; use @plys/libraries/profiles-port instead.',
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
