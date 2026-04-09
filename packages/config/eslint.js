/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:security/recommended-legacy',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'security'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
