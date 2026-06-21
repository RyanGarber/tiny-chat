import { defineConfig } from 'eslint/config';
import baseConfig from '../../eslint.config.base.ts';

export default defineConfig(
  ...baseConfig,
  {
    ignores: ['generated/**', 'prisma.config.ts', 'pm2.config.cjs'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
