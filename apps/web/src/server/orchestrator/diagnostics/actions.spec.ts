import { describe, expect, it, vi } from 'vitest'
import { requireUser } from '../shared'
import { getOrchestratorHealthSummaryAction } from './actions'
import { orchestratorDiagnosticsClient } from './client'

vi.mock('../shared', () => ({
  requireAdminUser: vi.fn(),
  requireUser: vi.fn()
}))
vi.mock('../current-user', () => ({
  getCurrentUserContext: vi.fn()
}))
vi.mock('./client', () => ({
  orchestratorDiagnosticsClient: {
    dockerMetrics: vi.fn(),
    healthSummary: vi.fn()
  }
}))

describe('orchestrator diagnostics actions', () => {
  it('uses the shallow health summary for routine status polling', async () => {
    await getOrchestratorHealthSummaryAction()

    expect(requireUser).toHaveBeenCalledTimes(1)
    expect(orchestratorDiagnosticsClient.healthSummary).toHaveBeenCalledTimes(1)
  })
})
