/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@plys/libraries/common-nest/(.*)$': '<rootDir>/../../../packages/common-nest/$1',
    '^@plys/libraries/database/(.*)$': '<rootDir>/../../../packages/database/$1',
    '^@plys/libraries/config/(.*)$': '<rootDir>/../../../packages/config/$1',
    '^@plys/libraries/unit-of-work/(.*)$': '<rootDir>/../../../packages/unit-of-work/$1',
    '^@plys/libraries/notifications$': '<rootDir>/../../../packages/notifications/index.ts',
    '^@plys/libraries/proto$': '<rootDir>/../../../packages/proto/index.ts',
    '^@plys/libraries/shared-kernel$': '<rootDir>/../../../packages/shared-kernel/index.ts',
  },
};
