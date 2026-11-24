import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Determinism rules for the pure packages (see AGENTS.md "Hard rules").
const pureRestrictions = {
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Pass `now` in as a parameter.' },
    { object: 'Math', property: 'random', message: 'Rendering must be deterministic.' },
    { object: 'performance', property: 'now', message: 'No clocks in core/render.' },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'fetch', message: 'No network in core/render.' },
    { name: 'window', message: 'No DOM in core/render.' },
    { name: 'document', message: 'No DOM in core/render.' },
    { name: 'localStorage', message: 'No storage in core/render.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: '`new Date()` reads the clock. Pass `now` in as a parameter.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'art/**', 'packages/phone/scriptable/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/tools/**/*.{js,ts}', '*.config.{js,ts}', 'packages/*/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/core/src/**/*.ts', 'packages/render/src/**/*.ts'],
    rules: pureRestrictions,
  },
);
