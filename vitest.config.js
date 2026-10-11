import { defineConfig } from 'vitest/config'

// Pure-function tests only (lib/format etc.): no DOM, no Vite plugins needed.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
