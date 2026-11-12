import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrchestratorPageHealth } from '../orchestrator-page-read'
import { getOrchestratorHealthSummaryAction } from './actions'
import { orchestratorDiagnosticsClient } from './client'

const { getServerAuthSession, getUserById } = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getUserById: vi.fn()
}))
vi.mock('@/server/auth/auth', () => ({ getServerAuthSession }))
vi.mock('@/server/auth/user', () => ({ userService: { getUserById } }))
vi.mock('@/server/persistence/auth-security-repository', () => ({ getAuthEpoch: () => 'test-epoch' }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`Redirect to ${path}`)
  }
}))
vi.mock('./client', () => ({
  orchestratorDiagnosticsClient: {
    healthSummary: vi.fn()
  }
}))

const account = { id: 'test-user', sessionVersion: 1, disabled: false, passwordChangeRequired: false }

describe('orchestrator diagnostics actions', () => {
  beforeEach(() => {
    getServerAuthSession.mockResolvedValue({
      user: { id: account.id, sessionVersion: account.sessionVersion, authEpoch: 'test-epoch' }
    })
    getUserById.mockResolvedValue({ ...account, isPlatformAdmin: false })
  })

  it('uses the shallow health summary for routine status polling', async () => {
    getUserById.mockResolvedValue({ ...account, isPlatformAdmin: true })
    await getOrchestratorHealthSummaryAction()

    expect(orchestratorDiagnosticsClient.healthSummary).toHaveBeenCalledTimes(1)
  })

  it('denies non-admin accounts before requesting diagnostics', async () => {
    await expect(getOrchestratorHealthSummaryAction()).rejects.toThrow('Redirect to /apps')

    expect(orchestratorDiagnosticsClient.healthSummary).not.toHaveBeenCalled()
  })

  it('allows authenticated server-rendered pages to check service availability for non-admins', async () => {
    await getOrchestratorPageHealth()

    expect(orchestratorDiagnosticsClient.healthSummary).toHaveBeenCalledTimes(1)
  })
})
