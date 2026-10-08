import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [{
  files: ['src/**/*.{js,jsx}'],
  ignores: ['src/**/*.test.js'],
  languageOptions: {
    ecmaVersion: 'latest', sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { ...globals.browser, ...globals.es2022 },
  },
  plugins: { 'react-hooks': reactHooks },
  linterOptions: { reportUnusedDisableDirectives: false },
  rules: { 'no-undef': 'error' },
}];
