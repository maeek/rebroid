import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/internal/automations/authorize/route'
import { PublicActionError } from '@/server/errors/public-action-error'
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
  it.each([
    [new PublicActionError('denied', { code: 'forbidden' }), 403],
    [new Error('upstream unavailable'), 503]
  ])('fails closed when authorization returns %s', async (error, status) => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'secret')
    vi.mocked(authorizeAutomationExecution).mockRejectedValue(error)
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
    expect(response.status).toBe(status)
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
    expect(response.status).toBe(400)
    expect(authorizeAutomationExecution).not.toHaveBeenCalled()
  })
})
