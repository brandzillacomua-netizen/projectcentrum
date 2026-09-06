import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20000,
    hookTimeout: 20000,
    globals: true,
    include: ['tests/**/*.test.{js,mjs,ts}']
  }
})
