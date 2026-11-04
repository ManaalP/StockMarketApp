module.exports = {
  root: true,
  extends: [
    'expo',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'error'
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'web-build/',
    'design/'
  ]
};
