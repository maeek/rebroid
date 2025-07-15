/** @type {import('jest').Config} */
module.exports = {
  verbose: true,
  coverageReporters: ['json-summary', 'lcov', 'text'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts', '!**/node_modules/**'],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'node'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|wav|mp3|gif|svg|m4a|aac|ogg|ttf|woff|woff2|mp4|webm)$': 'identity-obj-proxy',
    '\\.(css|sass|scss)$': 'jest-css-modules',
    '^@/(.*)': '<rootDir>/src/$1'
  },
  resetMocks: true,
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setup-tests.tsx'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false
      }
    ]
  },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
  testEnvironmentOptions: {
    /**
     * @note Opt-out from JSDOM using browser-style resolution
     * for dependencies. This is simply incorrect, as JSDOM is
     * not a browser, and loading browser-oriented bundles in
     * Node.js will break things.
     *
     * Consider migrating to a more modern test runner if you
     * don't want to deal with this.
     */
    customExportConditions: ['']
  }
};
