import stylistic from '@stylistic/eslint-plugin'
import js from '@eslint/js'
import { importX } from 'eslint-plugin-import-x'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const sourceFiles = ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'worker/**/*.ts', '*.config.ts']
const generatedUiFiles = ['src/components/ui/**/*.{ts,tsx}']

const styleConfig = stylistic.configs.customize({
  arrowParens: true,
  braceStyle: '1tbs',
  indent: 2,
  quoteProps: 'as-needed',
  quotes: 'single',
  semi: false,
  jsx: true,
})

export default tseslint.config(
  {
    ignores: [
      'coverage',
      'dist',
      'node_modules',
    ],
  },
  {
    files: sourceFiles,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      complexity: ['error', 25],
      eqeqeq: ['error', 'always'],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'import-x/no-duplicates': 'error',
      'import-x/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type',
        ],
        'newlines-between': 'never',
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
      }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: ['badgeVariants', 'buttonVariants'],
      }],
    },
  },
  {
    ...styleConfig,
    files: sourceFiles,
    ignores: generatedUiFiles,
    rules: {
      ...styleConfig.rules,
      '@stylistic/jsx-one-expression-per-line': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none',
          requireLast: false,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
      }],
    },
  },
  {
    files: generatedUiFiles,
    rules: {
      'import-x/first': 'off',
      'import-x/newline-after-import': 'off',
      'import-x/order': 'off',
    },
  },
  {
    files: ['src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../app/*', '../components/*', '../editor/*'],
            message: 'AI domain code may depend only on shared types and utilities.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/editor/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../ai/*', '../app/*', '../components/*'],
            message: 'Editor domain code may depend only on shared types and utilities.',
          },
        ],
      }],
    },
  },
)
