import { defineConfig } from 'vitest/config';

/**
 * Public tests shipped in the starter. Agents may add `*.test.ts` files here.
 * The holdout suite is configured separately and is not part of this run.
 */
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
