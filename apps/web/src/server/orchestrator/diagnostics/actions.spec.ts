import { describe, expect, it, vi } from 'vitest'
import { requireAdminUser, requireUser } from '../shared'
import { getDockerMetricsAction, getOrchestratorHealthSummaryAction } from './actions'
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
  it('requires an admin before loading Docker metrics', async () => {
    await getDockerMetricsAction()

    expect(requireAdminUser).toHaveBeenCalledTimes(1)
    expect(orchestratorDiagnosticsClient.dockerMetrics).toHaveBeenCalledTimes(1)
  })

  it('uses the shallow health summary for routine status polling', async () => {
    await getOrchestratorHealthSummaryAction()

    expect(requireUser).toHaveBeenCalledTimes(1)
    expect(orchestratorDiagnosticsClient.healthSummary).toHaveBeenCalledTimes(1)
  })
})
