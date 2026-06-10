import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
      include: ['src/app/api/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['src/tests/**', 'node_modules/**']
    },
    testTimeout: 10000, // Enforce 10s timeout
    hookTimeout: 10000
  }
});
