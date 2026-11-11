import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneStoredAppIcon, removeStoredAppIcon } from '@/server/app-icons/store'
import { runDueWebMaintenance } from '@/server/maintenance/web-maintenance'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { listRecentApplications, rememberRecentApplication } from '@/server/persistence/recent-applications-repository'
import { listDueWebMaintenance } from '@/server/persistence/web-maintenance-repository'
import { getCurrentUserContext } from '../../../current-user'
import { OrchestratorRequestError } from '../../../request'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppLifecycleClient } from '../../lifecycle-client'
import { requestApplicationCloneAction } from './clone-actions'
import {
  requestApplicationDeletionAction,
  requestApplicationStartAction,
  requestApplicationStopAction
} from './lifecycle-actions'
import type { AndroidApplication } from '@/shared/contracts/application'

vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/server/app-icons/store', () => ({ cloneStoredAppIcon: vi.fn(), removeStoredAppIcon: vi.fn() }))
vi.mock('../../../current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('../../../shared', () => ({ revalidateApplicationDetail: vi.fn(), revalidateApplicationList: vi.fn() }))
vi.mock('../../catalog-client', () => ({
  orchestratorAppCatalogClient: { getApplication: vi.fn(), deleteApplication: vi.fn(), cloneApplication: vi.fn() }
}))
vi.mock('../../lifecycle-client', () => ({
  orchestratorAppLifecycleClient: { startApplication: vi.fn(), stopApplication: vi.fn() }
}))

const id = '98a530d6-a45d-466a-9cb4-c023067c4971'

describe('application lifecycle acknowledgements', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-web-delete-'))
    vi.stubEnv('WEB_DATABASE_PATH', join(directory, 'state.sqlite'))
    vi.resetAllMocks()
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ownerUserId: 'owner',
      role: 'admin',
      permissions: {},
      quotas: { maxOpenApps: null, maxSessionSeconds: null, maxMemoryMb: null, maxCpuCpus: null }
    })
    vi.mocked(orchestratorAppCatalogClient.getApplication)
      .mockRejectedValue(new Error('Catalog unavailable after command'))
      .mockResolvedValueOnce({
        id,
        ownerUserId: 'owner',
        runtime: { image: 'fixture', resources: {}, inactivityTimeoutSeconds: null }
      } as unknown as AndroidApplication)
  })

  afterEach(async () => {
    resetDatabaseForTests()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it.each([
    {
      action: requestApplicationStartAction,
      client: orchestratorAppLifecycleClient.startApplication,
      status: 'provisioning',
      lifecycleStage: 'container_starting'
    },
    {
      action: requestApplicationStopAction,
      client: orchestratorAppLifecycleClient.stopApplication,
      status: 'stopped',
      lifecycleStage: 'stopped'
    }
  ] as const)(
    'returns the $status acknowledgement without reading the catalog again',
    async ({ action, client, status, lifecycleStage }) => {
      vi.mocked(client).mockResolvedValue({ id, name: 'App', status, lifecycleStage, message: null })
      await expect(action(id)).resolves.toMatchObject({ ok: true, data: { status, lifecycleStage } })
      expect(orchestratorAppCatalogClient.getApplication).toHaveBeenCalledTimes(1)
    }
  )

  it('resumes metadata cleanup from disk after queued deletion outlives the request', async () => {
    const app = { id, ownerUserId: 'other-owner' } as AndroidApplication
    rememberRecentApplication('owner', id)
    rememberRecentApplication('other-owner', id)
    vi.mocked(orchestratorAppCatalogClient.getApplication)
      .mockReset()
      .mockResolvedValueOnce(app)
      .mockResolvedValueOnce(app)
      .mockImplementationOnce(() => {
        expect(removeStoredAppIcon).not.toHaveBeenCalled()
        return Promise.reject(new OrchestratorRequestError('Application not found', 404))
      })
    vi.mocked(orchestratorAppCatalogClient.deleteApplication).mockResolvedValue({
      id,
      deleted: false,
      cleanupQueued: true,
      removedData: true
    })

    await expect(requestApplicationDeletionAction(id)).resolves.toMatchObject({
      ok: true,
      data: { deleted: false, cleanupQueued: true }
    })
    expect(orchestratorAppCatalogClient.getApplication).toHaveBeenCalledTimes(1)
    expect(removeStoredAppIcon).not.toHaveBeenCalled()
    const callback = vi.mocked(after).mock.calls[0]?.[0]
    if (typeof callback !== 'function') throw new Error('Expected deferred cleanup')
    await callback()
    expect(removeStoredAppIcon).not.toHaveBeenCalled()
    resetDatabaseForTests()
    await runDueWebMaintenance(Date.now() + 120_000)
    expect(removeStoredAppIcon).toHaveBeenCalledExactlyOnceWith(id)
    expect(listRecentApplications('owner')).toEqual([])
    expect(listRecentApplications('other-owner')).toEqual([])
    expect(listDueWebMaintenance(Date.now() + 120_000, 10)).toEqual([])
  })

  it('keeps the icon when deletion cannot be confirmed', async () => {
    vi.mocked(orchestratorAppCatalogClient.getApplication).mockRejectedValue(
      new OrchestratorRequestError('Access denied', 403)
    )
    vi.mocked(orchestratorAppCatalogClient.deleteApplication).mockResolvedValue({
      id,
      deleted: false,
      cleanupQueued: true,
      removedData: true
    })

    await expect(requestApplicationDeletionAction(id)).resolves.toMatchObject({ ok: true })
    const callback = vi.mocked(after).mock.calls[0]?.[0]
    if (typeof callback !== 'function') throw new Error('Expected deferred cleanup')
    await callback()
    expect(removeStoredAppIcon).not.toHaveBeenCalled()
  })

  it.each([
    { status: 403, retained: false },
    { status: 504, retained: true }
  ])('retains deletion intent only when a $status command result is ambiguous', async ({ status, retained }) => {
    vi.mocked(orchestratorAppCatalogClient.deleteApplication).mockRejectedValue(
      new OrchestratorRequestError('Delete not acknowledged', status)
    )
    await expect(requestApplicationDeletionAction(id)).resolves.toMatchObject({ ok: false })
    expect(listDueWebMaintenance(Date.now() + 120_000, 10)).toHaveLength(retained ? 1 : 0)
    expect(removeStoredAppIcon).not.toHaveBeenCalled()
  })

  it('preserves the stop permission and stable error code', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ownerUserId: 'owner',
      role: 'user',
      permissions: {},
      quotas: { maxOpenApps: null, maxSessionSeconds: null, maxMemoryMb: null, maxCpuCpus: null }
    })
    await expect(requestApplicationStopAction(id)).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(orchestratorAppLifecycleClient.stopApplication).not.toHaveBeenCalled()
  })

  it('returns the accepted clone ID despite an icon copy failure', async () => {
    const cloneId = '1fc7af3e-3a9d-4c83-b077-35513d85d8ef'
    vi.mocked(orchestratorAppCatalogClient.cloneApplication).mockResolvedValue({
      id: cloneId,
      name: 'App copy',
      status: 'provisioning',
      lifecycleStage: 'queued',
      message: null
    })
    vi.mocked(cloneStoredAppIcon).mockRejectedValue(new Error('Icon unavailable'))

    await expect(requestApplicationCloneAction(id)).resolves.toMatchObject({ ok: true, data: { id: cloneId } })
    expect(orchestratorAppCatalogClient.getApplication).toHaveBeenCalledTimes(1)
  })
})
