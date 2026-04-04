import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        HIS: 'readonly',
        VNPTStore: 'readonly',
        VNPTConfig: 'readonly',
        VNPTSettings: 'readonly',
        Aladinn: 'readonly',
        jQuery: 'readonly',
        $: 'readonly',
        VNPTSelectors: 'readonly',
        VNPTIntegration: 'writable',
        VNPTMessaging: 'readonly',
        DOM: 'readonly',
        jsonrpc: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }]
    }
  }
];
