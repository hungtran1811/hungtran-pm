import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['firestore-rules/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
