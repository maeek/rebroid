import { describe, expect, it, jest } from '@jest/globals'

jest.mock('../shared', () => ({
  requireAdminUser: jest.fn(),
  requireUser: jest.fn()
}))
jest.mock('../current-user', () => ({
  getCurrentUserContext: jest.fn()
}))
jest.mock('./client', () => ({
  orchestratorDiagnosticsClient: {
    dockerMetrics: jest.fn(),
    healthSummary: jest.fn()
  }
}))

const { requireAdminUser, requireUser } = jest.requireMock<typeof import('../shared')>('../shared')
const { orchestratorDiagnosticsClient } = jest.requireMock<typeof import('./client')>('./client')
const { getDockerMetricsAction, getOrchestratorHealthSummaryAction } =
  jest.requireActual<typeof import('./actions')>('./actions')

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
