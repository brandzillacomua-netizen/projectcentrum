import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(
  new URL('../.github/workflows/verify-deployment.yml', import.meta.url),
  'utf8'
)

describe('production release verification workflow', () => {
  it('runs only for a successful production deployment or an explicit manual run', () => {
    expect(workflow).toContain('deployment_status:')
    expect(workflow).toContain("github.event.deployment_status.state == 'success'")
    expect(workflow).toContain("startsWith(github.event.deployment.environment, 'Production')")
    expect(workflow).toContain("endsWith(github.event.deployment.environment, 'projectcentrum88')")
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'")
  })

  it('uses immutable action revisions and the deployment commit SHA', () => {
    expect(workflow).toContain('actions/checkout@11d5960a326750d5838078e36cf38b85af677262')
    expect(workflow).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020')
    expect(workflow).toContain('github.event.deployment.sha')
    expect(workflow).toContain("|| 'https://projectcentrum88.vercel.app'")
    expect(workflow).not.toContain('github.event.deployment_status.environment_url')
    expect(workflow).toContain('npm run verify:deployment')
  })
})
