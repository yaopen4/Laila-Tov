import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws unless the bundler picks its react-server export
      // condition, which vitest does not. The guard is a build-time assertion for
      // Next.js; under test the modules genuinely are running on the server.
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Rules tests share one emulator instance and clear Firestore between cases,
    // so they must not run concurrently.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
