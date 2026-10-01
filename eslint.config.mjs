export default [
  {
    files: ['**/*.mjs', '**/*.jsx'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        React: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  },
  {
    files: ['**/*.jsx'],
    rules: {
      // The repository intentionally uses React's automatic JSX runtime. Core
      // ESLint cannot mark JSX component identifiers as used without the React
      // plugin, which is not part of this local dependency set.
      'no-unused-vars': 'off'
    }
  },
  {
    ignores: ['**/.next/**', '**/node_modules/**', '**/dist/**']
  }
];
