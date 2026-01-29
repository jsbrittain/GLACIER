import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  // Global ignore block
  {
    ignores: ['node_modules', 'public', 'coverage']
  },

  // Vite config (ESM)
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: 'src'
        })
      ]
    }
  },

  // Backend (Node / ESM + TypeScript)
  {
    files: ['src/main/**/*.{js,jsx,ts,tsx}', 'src/preload/**/*.{js,jsx,ts,tsx}', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        URL: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'unused-imports': unusedImports,
      'jsx-a11y': jsxA11y
    },
    settings: {
      'import/resolver': {
        typescript: {
          /* project: './tsconfig.json' or backend tsconfig */
        }
      }
    },
    rules: {
      'no-unused-vars': 'off', // JS core rule off
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true
        }
      ],

      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': 'off',

      // backend-specific import rules:
      // allow devDependencies in scripts/tests but not in src
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            'test/**',
            'tests/**',
            '**/*.test.{js,jsx,ts,tsx}',
            'scripts/**',
            'build/**',
            'tools/**'
          ],
          optionalDependencies: false,
          peerDependencies: false
        }
      ],

      'import/no-unresolved': 'error'
    }
  },

  // Frontend (ESM + React)
  {
    files: ['src/renderer/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        alert: 'readonly'
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'unused-imports': unusedImports
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          /* project: './tsconfig.json' if needed */
        }
      }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',

      'no-unused-vars': 'off', // JS core rule off
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true
        }
      ],

      // unused-imports plugin (detects & can auto-fix unused imports)
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': 'off',

      // helpful import resolution rules
      'import/no-unresolved': 'error',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/*.test.*', 'test/**', 'tests/**', 'scripts/**']
        }
      ]
    }
  }
];
