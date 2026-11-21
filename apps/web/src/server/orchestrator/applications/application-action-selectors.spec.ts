import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { applicationPreview } from '@/shared/testing/application-preview'
import { getCurrentUserContext } from '../current-user'
import { updateNetworkPolicyAction } from './actions/configuration/network-policy-actions'
import { deleteApplicationRuntimeFileAction } from './actions/runtime/file-actions'
import { getApplicationLogsAction } from './actions/runtime/log-actions'
import { recordViewerActivityAction } from './actions/runtime/viewer-actions'
import { orchestratorAppRuntimeClient } from './runtime-client'
import type { UpdateNetworkPolicyInput } from '@/shared/contracts/application'

vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/persistence/web-maintenance-repository', () => ({ hasPendingViewerRevocation: vi.fn(() => false) }))
vi.mock('../current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('../features', () => ({ requireFeature: vi.fn() }))
vi.mock('../shared', () => ({ revalidateApplicationDetail: vi.fn(), revalidateApplicationList: vi.fn() }))

const appId = '3efe13c4-d805-42f9-a583-c6c6f6815b62'
const otherAppId = '715145a8-936a-4db3-a825-f50efedceddf'
const fetchUpstream = vi.fn<typeof fetch>()

describe('application action URL selectors', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ownerUserId: 'owner-1',
      isPlatformAdmin: false,
      permissions: {
        'applications:view-logs': true,
        'applications:configure-egress': true,
        'applications:transfer-files': true,
        'applications:manage-files': true
      },
      quotas: { maxOpenApps: null, maxSessionSeconds: 3600, maxCpuCpus: null, maxMemoryMb: null }
    })
    fetchUpstream.mockImplementation(input => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      if (path.endsWith('/logs/container')) return Promise.resolve(Response.json({ output: 'Owned application log' }))
      if (path.endsWith('/logs/orchestrator')) return Promise.resolve(Response.json({ output: 'Other owner log' }))
      return Promise.resolve(Response.json({ ...applicationPreview, id: appId, ownerUserId: 'owner-1' }))
    })
    vi.stubGlobal('fetch', fetchUpstream)
    vi.stubEnv('ORCHESTRATOR_API_URL', 'http://orchestrator.test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('posts viewer activity with the authenticated account and no full application read', async () => {
    const runtimeKey = 'a'.repeat(64)
    await expect(recordViewerActivityAction(appId, runtimeKey)).resolves.toMatchObject({ ok: true })
    expect(fetchUpstream).toHaveBeenCalledExactlyOnceWith(
      `http://orchestrator.test/api/v1/apps/${appId}/viewer/activity`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ownerUserId: 'owner-1', runtimeKey })
      })
    )
  })

  it('withholds viewer activity during account revocation or for a malformed runtime key', async () => {
    await expect(recordViewerActivityAction(appId, 'invalid')).resolves.toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    vi.mocked(hasPendingViewerRevocation).mockReturnValueOnce(true)
    await expect(recordViewerActivityAction(appId, 'a'.repeat(64))).resolves.toMatchObject({
      ok: false,
      error: { code: 'upstream_unavailable', status: 503 }
    })
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it('rejects a log source that would change the application in the upstream URL', async () => {
    const source = `../../../${otherAppId}/runtime/logs/orchestrator` as Parameters<typeof getApplicationLogsAction>[1]

    await expect(getApplicationLogsAction(appId, source)).rejects.toMatchObject({ code: 'validation' })
    expect(fetchUpstream).toHaveBeenCalledTimes(1)
    expect(fetchUpstream).toHaveBeenCalledWith(
      `http://orchestrator.test/api/v1/apps/${appId}/viewer-runtime`,
      expect.anything()
    )
  })

  it('routes a supported log request to the authorized application', async () => {
    await expect(getApplicationLogsAction(appId, 'container', 15)).resolves.toMatchObject({
      output: 'Owned application log'
    })
    expect(fetchUpstream).toHaveBeenLastCalledWith(
      `http://orchestrator.test/api/v1/apps/${appId}/runtime/logs/container?tail=15`,
      expect.anything()
    )
  })

  it('rejects a network policy update with a fragment in the application ID', async () => {
    const input = { inactivityTimeoutSeconds: -1 } as UpdateNetworkPolicyInput

    await expect(updateNetworkPolicyAction(`${appId}#`, input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'not_found' }
    })
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it('rejects settings outside the network policy contract for a valid application ID', async () => {
    const input = { networkPolicyEnabled: false, inactivityTimeoutSeconds: -1 }

    await expect(updateNetworkPolicyAction(appId, input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'validation' }
    })
    expect(fetchUpstream.mock.calls.every(([, init]) => init?.method !== 'PATCH')).toBe(true)
  })

  it('rejects runtime file deletion with a fragment in the application ID', async () => {
    await expect(deleteApplicationRuntimeFileAction(`${appId}#`, '/data/example.txt')).resolves.toMatchObject({
      ok: false,
      error: { code: 'not_found' }
    })
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it('keeps a download filename containing URL punctuation in one path segment', async () => {
    fetchUpstream.mockResolvedValueOnce(Response.json({ name: 'report #?.txt' }))

    await orchestratorAppRuntimeClient.downloadFile(appId, 'report #?.txt')

    expect(fetchUpstream).toHaveBeenCalledWith(
      `http://orchestrator.test/api/v1/apps/${appId}/runtime/download-files/report%20%23%3F.txt`,
      expect.anything()
    )
  })

  it('rejects a download filename that would collapse to a parent URL', () => {
    expect(() => orchestratorAppRuntimeClient.downloadFile(appId, '..')).toThrow('Invalid application path selector.')
    expect(fetchUpstream).not.toHaveBeenCalled()
  })
})
