import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { applicationPreview } from '@/shared/testing/application-preview'
import { loadFirewallPageData } from './page-data.server'
import type { PublicUser } from '@/shared/contracts/auth-user'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/server/auth/user', () => ({ userService: { listUsers: vi.fn() } }))
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/get-server-ui-settings', () => ({ getRequiredServerOrchestratorUiSettings: vi.fn() }))
vi.mock('@/server/orchestrator/settings/client', () => ({ orchestratorSettingsClient: { getFeatures: vi.fn() } }))

const firewall = { ok: false, status: 'offline', message: 'Firewall agent is offline.' } as const
const health = { services: { firewall } } as OrchestratorHealth
const feature = { key: 'feature.firewall', supported: true, enabled: true } as FeatureFlagState

describe('Firewall page data', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns saved connection settings and policies with owner usernames when the agent is offline', async () => {
    vi.mocked(orchestratorSettingsClient.getFeatures).mockResolvedValue({ revision: 1, features: [feature] })
    vi.mocked(getRequiredServerOrchestratorUiSettings).mockResolvedValue(defaultOrchestratorUiSettings)
    vi.mocked(listApplicationsAction).mockResolvedValue([applicationPreview])
    vi.mocked(userService.listUsers).mockResolvedValue([
      { id: 'preview-owner', username: 'operator', name: 'Platform Operator' } as PublicUser
    ])

    await expect(loadFirewallPageData(health)).resolves.toMatchObject({
      initialHealth: firewall,
      initialSettings: defaultOrchestratorUiSettings.services.firewall,
      initialApplications: [{ ...applicationPreview, ownerUsername: 'operator' }]
    })
  })

  it('skips the policy inventory when the feature is disabled', async () => {
    vi.mocked(orchestratorSettingsClient.getFeatures).mockResolvedValue({
      revision: 1,
      features: [{ ...feature, enabled: false }]
    })
    vi.mocked(getRequiredServerOrchestratorUiSettings).mockResolvedValue(defaultOrchestratorUiSettings)

    const data = await loadFirewallPageData(health)

    expect(listApplicationsAction).not.toHaveBeenCalled()
    expect(userService.listUsers).not.toHaveBeenCalled()
    expect(data.initialApplications).toBeUndefined()
    expect(data.initialSettings).toEqual(defaultOrchestratorUiSettings.services.firewall)
  })

  it('keeps connection settings available when loading the policy inventory fails', async () => {
    vi.mocked(orchestratorSettingsClient.getFeatures).mockResolvedValue({ revision: 1, features: [feature] })
    vi.mocked(getRequiredServerOrchestratorUiSettings).mockResolvedValue(defaultOrchestratorUiSettings)
    vi.mocked(listApplicationsAction).mockRejectedValue(new OrchestratorRequestError('offline', 503, 'policies-ref'))
    vi.mocked(userService.listUsers).mockResolvedValue([])

    await expect(loadFirewallPageData(health)).resolves.toMatchObject({
      initialSettings: defaultOrchestratorUiSettings.services.firewall,
      initialApplications: undefined,
      policyFailure: { requestId: 'policies-ref' }
    })
  })
})
