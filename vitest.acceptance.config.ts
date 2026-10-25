import { defineConfig } from 'vitest/config';

/**
 * Evaluator-owned holdout suite. The benchmark-start snapshot omits this file
 * and `evaluator/` so trial agents cannot read or edit these cases.
 */
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['evaluator/acceptance/**/*.test.ts'],
  },
});
