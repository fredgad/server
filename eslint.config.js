import globals from 'globals';
import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config} */
const config = {
  files: ['**/*.{js,mjs,cjs,ts}'],
  languageOptions: {
    parser: tsParser, // Добавляем парсер TypeScript
    globals: globals.browser,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  rules: {
    // Настройте свои правила, если нужно
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
};

export default config;

// import globals from "globals";
// import pluginJs from "@eslint/js";
// import tseslint from "typescript-eslint";

// /** @type {import('eslint').Linter.Config[]} */
// export default [
//   {files: ["**/*.{js,mjs,cjs,ts}"]},

//   {languageOptions: { globals: globals.browser }},
//   pluginJs.configs.recommended,
//   ...tseslint.configs.recommended,
// ];

// env: {
//   es2020: true,
//   node: true,
// },
// parserOptions: {
//   ecmaVersion: 2020,
//   sourceType: 'module',
// },
// rules: {
//   'import/no-commonjs': 'error',
// },
