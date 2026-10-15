import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    env: { CODEPLATE_QUIET: '1', NEXT_PUBLIC_PADDLE_PRICE_PRO: 'pri_test_pro', NEXT_PUBLIC_PADDLE_PRICE_TEAM: 'pri_test_team' },
    testTimeout: 30000,
  },
});
