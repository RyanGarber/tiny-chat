import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';

export default defineConfig({
  plugins: [
    {
      name: 'strip-broken-sourcemaps',
      enforce: 'pre',
      load(id) {
        if (!id.includes('rrule/dist/esm')) return null;
        const code = fs.readFileSync(id, 'utf-8');
        return {
          code: code.replace(/\/\/# sourceMappingURL=\S+/, ''),
          map: { mappings: '' },
        };
      },
    },
  ],
  test: {
    include: ['packages/**/*.test.ts'],
    globalSetup: ['packages/backend/src/tests.ts', 'packages/shared/src/tests.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
