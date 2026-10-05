import { defineConfig } from 'vitest/config'
export default defineConfig({test:{environment:'node',include:['tmp/factory-audit-reproductions.test.js'],setupFiles:['./tests/setup.js']}})
