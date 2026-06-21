import { defineConfig } from 'eslint/config';
import baseConfig from '../../eslint.config.base.ts';

export default defineConfig(...baseConfig, {
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
