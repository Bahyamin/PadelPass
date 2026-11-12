import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules', 'coverage'] },
  js.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    // Express error handlers need 4 parameters even when the last is unused.
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  prettier,
];
