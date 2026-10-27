// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // react-three-fiber elements take three.js props (position, intensity, ...)
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
