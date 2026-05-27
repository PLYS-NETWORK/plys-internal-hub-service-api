/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  roots: ['<rootDir>/ai-provider-key', '<rootDir>/common-nest', '<rootDir>/config'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@plys/libraries/common-nest/(.*)$': '<rootDir>/common-nest/$1',
    '^@plys/libraries/database/(.*)$': '<rootDir>/database/$1',
    '^@plys/libraries/config/(.*)$': '<rootDir>/config/$1',
    '^@plys/libraries/unit-of-work/(.*)$': '<rootDir>/unit-of-work/$1',
    '^@plys/libraries/proto$': '<rootDir>/proto/index.ts',
    '^@plys/libraries/shared-kernel$': '<rootDir>/shared-kernel/index.ts',
  },
};
