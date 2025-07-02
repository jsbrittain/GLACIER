import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

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
    }
  },

  // Backend (ESM)
  {
    files: ['src/main/**/*.{js,jsx}', 'src/preload/**/*.{js,jsx}', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        URL: 'readonly'
      }
    }
  },

  // Frontend (ESM + React)
  {
    files: ['src/renderer/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
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
      'jsx-a11y': jsxA11y
    },
    rules: {
      'react/react-in-jsx-scope': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
];
