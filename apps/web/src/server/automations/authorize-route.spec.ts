import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/internal/automations/authorize/route'
import { authorizeAutomationExecution } from './authorize-execution'
vi.mock('./authorize-execution', () => ({ authorizeAutomationExecution: vi.fn() }))
describe('private execution authorization endpoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(authorizeAutomationExecution).mockReset()
  })
  it('rejects unauthenticated requests before parsing or authorizing', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'secret')
    const response = await POST(
      new Request('http://web/api/internal/automations/authorize', { method: 'POST', body: 'invalid' })
    )
    expect(response.status).toBe(401)
    expect(authorizeAutomationExecution).not.toHaveBeenCalled()
  })
  it('fails closed when current permissions are denied', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'secret')
    vi.mocked(authorizeAutomationExecution).mockRejectedValue(new Error('denied'))
    const response = await POST(
      new Request('http://web/api/internal/automations/authorize', {
        method: 'POST',
        headers: { 'x-orchestrator-secret': 'secret' },
        body: JSON.stringify({
          ownerUserId: 'u',
          targetApplicationId: 'a',
          definition: { spec: { steps: [] } },
          operation: 'start'
        })
      })
    )
    expect(response.status).toBe(403)
    expect(authorizeAutomationExecution).toHaveBeenCalledWith(expect.objectContaining({ operation: 'start' }))
  })
  it('rejects legacy requests that specify a policy without an operation', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'secret')
    const response = await POST(
      new Request('http://web/api/internal/automations/authorize', {
        method: 'POST',
        headers: { 'x-orchestrator-secret': 'secret' },
        body: JSON.stringify({
          ownerUserId: 'u',
          targetApplicationId: 'a',
          definition: { spec: { steps: [] } },
          startPolicy: 'start-if-needed'
        })
      })
    )
    expect(response.status).toBe(403)
    expect(authorizeAutomationExecution).not.toHaveBeenCalled()
  })
})
