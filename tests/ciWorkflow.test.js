import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8'
)

describe('CI workflow', () => {
  it('checks the entry bundle after the production build', () => {
    const buildIndex = workflow.indexOf('run: npm run build')
    const budgetIndex = workflow.indexOf('run: npm run build:check')

    expect(buildIndex).toBeGreaterThan(-1)
    expect(budgetIndex).toBeGreaterThan(buildIndex)
  })
})
