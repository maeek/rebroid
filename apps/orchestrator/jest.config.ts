import type { Config } from 'jest';

const config: Config = {
  maxWorkers: 4,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '[/\\\\](?:cookie|content-disposition)[/\\\\]dist[/\\\\].+\\.js$': [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'CommonJS' }, diagnostics: false },
    ],
  },
  // Node 24 supports these ESM dependencies through require; Jest's VM needs transformation.
  transformIgnorePatterns: [
    '/node_modules/(?!\\.pnpm/(?:cookie@2\\.|content-disposition@3\\.)|(?:cookie|content-disposition)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/database/migrations/**/*.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
