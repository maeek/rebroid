import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { applicationPreview } from '@/shared/testing/application-preview'
import { getApplicationLoadingDisplaySize, getApplicationPageData } from './application-page-data.server'

vi.mock('@/server/orchestrator/applications/actions/queries/get-application-action', () => ({
  getApplicationAction: vi.fn()
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/get-server-ui-settings', () => ({ getServerOrchestratorUiSettings: vi.fn() }))
vi.mock('@/server/users/owner-display-names', () => ({
  getOwnerDisplayName: vi.fn(),
  getVisibleOwnerDisplayNames: vi.fn()
}))
vi.mock('@/features/applications/icons/enrich', () => ({ withStoredAppIcon: vi.fn() }))
vi.mock('@/server/observability/logger', () => ({ logger: { error: vi.fn() } }))

describe('Application page data failure states', () => {
  const appId = '6d8b5e09-e4bf-4568-9aa9-0572237c04d3'

  afterEach(() => vi.clearAllMocks())

  it('rejects a malformed app link before querying the orchestrator', async () => {
    await expect(getApplicationPageData('undefined')).resolves.toEqual({ failure: { kind: 'invalid-link' } })
    await expect(getApplicationLoadingDisplaySize('undefined')).resolves.toBeNull()
    expect(getApplicationAction).not.toHaveBeenCalled()
  })

  it.each([
    new OrchestratorRequestError('App not found', 404, 'load-request-1'),
    new PublicActionError('App not found', { code: 'not_found', status: 404 }),
    new PublicActionError('Access denied', { code: 'forbidden', status: 403 })
  ])('renders the same response for missing and inaccessible apps', async error => {
    vi.mocked(getApplicationAction).mockRejectedValueOnce(error)
    await expect(getApplicationPageData(appId)).resolves.toEqual({ failure: { kind: 'not-found' } })
    vi.mocked(getApplicationAction).mockRejectedValueOnce(error)
    await expect(getApplicationLoadingDisplaySize(appId)).resolves.toBeNull()
  })

  it('reads the configured tablet dimensions from the authorized app definition', async () => {
    vi.mocked(getApplicationAction).mockResolvedValueOnce({
      ...applicationPreview,
      runtime: {
        ...applicationPreview.runtime,
        containerArgs: 'androidboot.redroid_width=1600 androidboot.redroid_height=1000'
      }
    })
    await expect(getApplicationLoadingDisplaySize(appId)).resolves.toMatchObject({ width: 1600, height: 1000 })
    expect(getApplicationAction).toHaveBeenCalledExactlyOnceWith(appId)
  })

  it('preserves the request ID and classifies a service failure separately', async () => {
    vi.mocked(getApplicationAction).mockRejectedValueOnce(
      new OrchestratorRequestError('Private cause', 503, 'load-request-2')
    )
    await expect(getApplicationPageData(appId)).resolves.toEqual({
      failure: { kind: 'unavailable', requestId: 'load-request-2' }
    })
  })
})
