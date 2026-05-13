import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    include: ['packages/**/*.test.ts'],
  },
});
