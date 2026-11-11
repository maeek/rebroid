import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fullPermissions } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { loadFeatureFlags, requireFeature } from '../../../features'
import { OrchestratorRequestError } from '../../../request'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppNetworkPolicyClient } from '../../network-policy-client'
import { enforceResourceQuotas } from '../../safety'
import { submitCreateApplicationAction } from './create-update-actions'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from './network-policy-actions'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('../../../current-user', () => ({
  getCurrentUserContext: vi.fn(),
  getCurrentOwnerUserId: () => Promise.resolve('owner-1')
}))
vi.mock('../../../features', () => ({ loadFeatureFlags: vi.fn().mockResolvedValue(null), requireFeature: vi.fn() }))
vi.mock('../../../shared', () => ({ revalidateApplicationDetail: vi.fn(), revalidateApplicationList: vi.fn() }))
vi.mock('../../catalog-client', () => ({
  orchestratorAppCatalogClient: { getApplication: vi.fn(), createApplication: vi.fn() }
}))
vi.mock('../../lifecycle-client', () => ({ orchestratorAppLifecycleClient: {} }))
vi.mock('../../network-policy-client', () => ({
  orchestratorAppNetworkPolicyClient: {
    updateNetworkPolicy: vi.fn(),
    applyNetworkPolicy: vi.fn(),
    reconcileNetworkPolicies: vi.fn()
  }
}))
vi.mock('../../safety', () => ({
  applyCreateResourceQuotas: (input: unknown) => input,
  sanitizeAndroidApplicationForUser: (app: unknown) => app,
  enforceResourceQuotas: vi.fn(),
  enforceSessionQuota: vi.fn()
}))

const user = (
  permissions: PermissionMap = {},
  isPlatformAdmin = false,
  quotas: ResourceQuota = { maxOpenApps: null, maxSessionSeconds: null, maxMemoryMb: null, maxCpuCpus: null }
) => ({
  ownerUserId: 'owner-1',
  isPlatformAdmin,
  permissions: isPlatformAdmin ? { ...fullPermissions, ...permissions } : permissions,
  quotas
})

const disabledFirewall: FeatureFlagManifest = {
  revision: 1,
  features: [
    {
      key: 'feature.firewall',
      owner: 'network-policy',
      description: 'Firewall enforcement.',
      revision: 1,
      control: 'runtime',
      mutable: true,
      enabled: false,
      supported: true,
      effective: false,
      syncStatus: 'applied',
      disablePolicy: 'block_new',
      lifecycle: 'permanent',
      removalCondition: null,
      dependencies: [],
      conflicts: []
    }
  ]
}

describe('network policy actions', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(
      user({
        'applications:configure-egress': true,
        'applications:use-internet': true
      })
    )
    vi.mocked(orchestratorAppCatalogClient.getApplication).mockResolvedValue({
      id: 'app-1',
      name: 'Test app',
      ownerUserId: 'owner-1'
    } as Awaited<ReturnType<typeof orchestratorAppCatalogClient.getApplication>>)
    vi.mocked(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).mockResolvedValue({
      id: 'app-1',
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppNetworkPolicyClient.updateNetworkPolicy>>)
    vi.mocked(orchestratorAppNetworkPolicyClient.applyNetworkPolicy).mockResolvedValue({
      id: 'app-1',
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppNetworkPolicyClient.applyNetworkPolicy>>)
    vi.mocked(requireFeature).mockRejectedValue(new Error('feature.firewall is disabled.'))
  })

  it('allows disabling and applying a policy without a web feature gate', async () => {
    const input = { networkPolicyEnabled: false, networkPolicyAllowCidrs: [] }
    expect(await updateNetworkPolicyAction('app-1', input)).toMatchObject({ ok: true })
    expect(await applyNetworkPolicyAction('app-1')).toMatchObject({ ok: true })
    expect(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).toHaveBeenCalledWith('app-1', input)
    expect(orchestratorAppNetworkPolicyClient.applyNetworkPolicy).toHaveBeenCalledWith('app-1')
    expect(requireFeature).not.toHaveBeenCalled()
  })

  it('preserves the unrestricted internet permission check', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({ 'applications:configure-egress': true }))
    await expect(updateNetworkPolicyAction('app-1', { networkPolicyEnabled: false })).resolves.toMatchObject({
      ok: false,
      error: { code: 'forbidden', message: 'You do not have permission to allow broad internet access.' }
    })
    expect(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).not.toHaveBeenCalled()
  })

  it.each([updateNetworkPolicyAction, applyNetworkPolicyAction])(
    'preserves configuration permissions',
    async action => {
      vi.mocked(getCurrentUserContext).mockResolvedValue(user({ 'applications:use-internet': true }))
      await expect(action('app-1', { networkPolicyEnabled: false })).resolves.toMatchObject({
        ok: false,
        error: { code: 'forbidden' }
      })
      expect(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).not.toHaveBeenCalled()
      expect(orchestratorAppNetworkPolicyClient.applyNetworkPolicy).not.toHaveBeenCalled()
    }
  )

  it.each([updateNetworkPolicyAction, applyNetworkPolicyAction])('preserves ownership checks', async action => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ ...user({}, false), ownerUserId: 'other-owner' })
    await expect(action('app-1', { networkPolicyEnabled: false })).resolves.toMatchObject({
      ok: false,
      error: { code: 'not_found' }
    })
    expect(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).not.toHaveBeenCalled()
    expect(orchestratorAppNetworkPolicyClient.applyNetworkPolicy).not.toHaveBeenCalled()
  })

  it('passes enforcement errors through instead of throwing a page-not-found error', async () => {
    vi.mocked(orchestratorAppNetworkPolicyClient.updateNetworkPolicy).mockRejectedValue(
      new OrchestratorRequestError('feature.firewall is disabled.', 409)
    )
    await expect(updateNetworkPolicyAction('app-1', { networkPolicyEnabled: true })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'conflict',
        message: 'Could not save network policy. Restricted access requires the Firewall feature to be enabled.'
      }
    })
    expect(requireFeature).not.toHaveBeenCalled()
  })

  it('keeps bulk reconciliation gated', async () => {
    await expect(reconcileNetworkPoliciesAction()).rejects.toThrow('feature.firewall is disabled.')
    expect(orchestratorAppNetworkPolicyClient.reconcileNetworkPolicies).not.toHaveBeenCalled()
  })

  it('allows creating an unrestricted app while firewall is disabled', async () => {
    const appId = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({}, true))
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockResolvedValue({
      id: appId,
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppCatalogClient.createApplication>>)
    const result = await submitCreateApplicationAction({
      name: 'Test app',
      networkPolicyEnabled: false,
      networkPolicyAllowCidrs: []
    })
    expect(result).toMatchObject({ ok: true, data: { id: appId } })
    expect(orchestratorAppCatalogClient.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ networkPolicyEnabled: false }),
      result.requestId,
      null,
      expect.objectContaining({ isPlatformAdmin: true })
    )
    expect(orchestratorAppCatalogClient.getApplication).not.toHaveBeenCalled()
    expect(requireFeature).not.toHaveBeenCalled()
  })

  it('uses unrestricted access for a draft with no network fields when Firewall is disabled', async () => {
    const actor = user({ 'applications:create': true, 'applications:use-internet': true })
    const id = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    vi.mocked(getCurrentUserContext).mockResolvedValue(actor)
    vi.mocked(loadFeatureFlags).mockResolvedValueOnce(disabledFirewall)
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockResolvedValue({
      id,
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppCatalogClient.createApplication>>)

    const result = await submitCreateApplicationAction({ name: 'Test app' })

    expect(result).toMatchObject({ ok: true, data: { id } })
    expect(orchestratorAppCatalogClient.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test app', networkPolicyEnabled: false }),
      result.requestId,
      null,
      actor
    )
  })

  it('denies creation without unrestricted internet permission when Firewall is disabled', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({ 'applications:create': true }))
    vi.mocked(loadFeatureFlags).mockResolvedValueOnce(disabledFirewall)

    await expect(submitCreateApplicationAction({ name: 'Test app' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'forbidden' }
    })
    expect(orchestratorAppCatalogClient.createApplication).not.toHaveBeenCalled()
  })

  it('skips web quota checks while preserving the configured limit for transactional admission', async () => {
    const actor = user({}, true, { maxOpenApps: 0, maxCpuCpus: 1, maxMemoryMb: 512, maxSessionSeconds: 60 })
    vi.mocked(getCurrentUserContext).mockResolvedValue(actor)
    vi.mocked(loadFeatureFlags).mockResolvedValueOnce({
      revision: 1,
      features: [
        {
          key: 'feature.resource-quota',
          owner: 'android-apps',
          description: 'Per-user resource quotas.',
          revision: 1,
          control: 'runtime',
          mutable: true,
          enabled: false,
          supported: true,
          effective: false,
          syncStatus: 'applied',
          disablePolicy: 'block_new',
          lifecycle: 'permanent',
          removalCondition: null,
          dependencies: [],
          conflicts: []
        }
      ]
    })
    const id = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockResolvedValue({
      id,
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppCatalogClient.createApplication>>)
    const result = await submitCreateApplicationAction({ name: 'Test app' })
    expect(result).toMatchObject({ ok: true, data: { id } })
    expect(enforceResourceQuotas).toHaveBeenCalledWith(
      { name: 'Test app' },
      { maxOpenApps: null, maxCpuCpus: null, maxMemoryMb: null, maxSessionSeconds: null }
    )
    expect(orchestratorAppCatalogClient.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test app' }),
      result.requestId,
      0,
      actor
    )
  })

  it('treats an acknowledgement with no app ID as unconfirmed', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({}, true))
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockResolvedValue({
      name: 'Test app'
    } as Awaited<ReturnType<typeof orchestratorAppCatalogClient.createApplication>>)
    const result = await submitCreateApplicationAction({ name: 'Test app' })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'upstream_error', requestId: result.requestId }
    })
    expect(!result.ok && result.error.message).toContain('Check All apps before trying again')
  })

  it.each([true, undefined])('keeps restricted creation gated (%s)', async networkPolicyEnabled => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({}, true))
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockRejectedValue(
      new OrchestratorRequestError('feature.firewall is disabled.', 409, 'request-1', { code: 'feature_disabled' })
    )
    const result = await submitCreateApplicationAction({ name: 'Test app', networkPolicyEnabled })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'conflict' }
    })
    expect(!result.ok && result.error.message).toContain('Restricted network access requires Firewall')
  })

  it('returns a safe outage message with the same request reference sent upstream', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({}, true))
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockRejectedValue(
      new OrchestratorRequestError('connect ENOENT /private/container-engine.sock', 503, 'request-1', {
        code: 'container_engine_unavailable'
      })
    )
    const result = await submitCreateApplicationAction({ name: 'Test app', networkPolicyEnabled: false })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'upstream_unavailable' }
    })
    expect(!result.ok && result.error.message).toContain('Docker or Podman connection')
    expect(JSON.stringify(result)).not.toContain('/private/')
    expect(orchestratorAppCatalogClient.createApplication).toHaveBeenCalledWith(
      expect.anything(),
      result.requestId,
      null,
      expect.objectContaining({ isPlatformAdmin: true })
    )
  })

  it('maps validation field names without forwarding upstream details', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(user({}, true))
    vi.mocked(orchestratorAppCatalogClient.createApplication).mockRejectedValue(
      new OrchestratorRequestError('private backend details', 400, 'request-1', {
        fields: ['memoryLimitMb', 'ownerUserId']
      })
    )
    await expect(submitCreateApplicationAction({ name: 'Test app' })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'validation',
        fieldErrors: { memoryLimitMb: ['Enter a whole number from 128 to 262,144 MB.'] }
      }
    })
  })
})
