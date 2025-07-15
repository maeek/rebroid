const path = require('path')

/** @type {import('@types/eslint').Linter.Config} */
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'prettier',
    'plugin:import/recommended',
    // 'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:testing-library/react'
  ],
  plugins: ['react', 'prettier', '@typescript-eslint', 'jsx-a11y', 'import', 'react-hooks', 'testing-library'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      excludedFiles: ['.test.ts', '.test.tsx'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking'
      ],
      parserOptions: {
        project: path.resolve(__dirname, './tsconfig.json'),
        tsconfigRootDir: __dirname
      },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-namespace': 'off',
        'react/react-in-jsx-scope': 'off'
      }
    },
    {
      files: ['*.js'],
      plugins: ['node'],
      extends: ['plugin:node/recommended']
    },
    {
      files: ['*.test.ts', '*.test.tsx'],
      plugins: ['jest', 'testing-library'],
      extends: ['plugin:jest/recommended', 'plugin:testing-library/react'],
      rules: {
        'testing-library/render-result-naming-convention': 'off'
      }
    }
  ],
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2020,
    ecmaFeatures: {
      legacyDecorators: true,
      jsx: true
    }
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    },
    react: {
      version: 'detect'
    }
  },
  globals: {
    __DEV__: 'readonly',
    __DEMO__: 'readonly',
    __PROD__: 'readonly'
  },
  rules: {
    'max-len': ['error', { code: 120, ignoreComments: true, ignoreUrls: true, ignoreStrings: true }],
    'linebreak-style': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'arrow-parens': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/type-annotation-spacing': ['error'],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react/function-component-definition': 'off',
    'jsx-quotes': ['warn', 'prefer-single'],
    'prettier/prettier': 'error',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'import/named': 'off',
    'import/no-unresolved': 'error',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
        js: 'never'
      }
    ],
    'import/order': [
      'error',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroupsExcludedImportTypes: ['react'],
        warnOnUnassignedImports: true,
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'object', 'type'],
        pathGroups: [
          { pattern: 'react', group: 'builtin', position: 'before' },
          { pattern: '**/*.scss', group: 'type', position: 'after' },
          { pattern: './*.scss', group: 'type', position: 'after' },
          { pattern: '**/*.css', group: 'type', position: 'after' }
        ]
      }
    ],
    'eol-last': 'error'
  }
}
