// ESLint flat config — works with any IDE via the ESLint CLI or language-server.
// VSCode/Cursor/Windsurf: install the ESLint extension (dbaeumer.vscode-eslint).
// JetBrains IDEs: ESLint support is built-in (Preferences → Languages → JavaScript → ESLint).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // ── Files to skip entirely ──────────────────────────────────────────────────
  {
    ignores: [
      'dist/',
      'build/',
      'coverage/',
      'node_modules/',
      '.claude/',
      'android/',
      'playwright-report/',
      'test-results/',
      '*.min.js',
    ],
  },

  // ── Base JS rules ───────────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript rules ────────────────────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── React + React Hooks rules ───────────────────────────────────────────────
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React 17+ JSX transform — no need to import React in every file
      'react/react-in-jsx-scope': 'off',
      // TypeScript handles prop validation
      'react/prop-types': 'off',
      // Hooks must follow the Rules of Hooks
      'react-hooks/rules-of-hooks': 'error',
      // Warn on missing deps in useEffect/useCallback/useMemo
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript — downgrade to warnings to avoid blocking builds during migration
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'warn',

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ── Server-side files (Node globals, relax browser rules) ───────────────────
  {
    files: ['server.ts', 'server.mocks.ts', 'api/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // ── Test files (relax rules that don't apply in tests) ──────────────────────
  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  }
);
