import { defineConfig } from 'vitest/config';

// Tests never touch the development database: they use their own one.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://padelpass:padelpass@localhost:5433/padelpass_test';

export default defineConfig({
  test: {
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: './tests/globalSetup.js',
    // Test files share one database, so they run one after the other.
    fileParallelism: false,
  },
});
