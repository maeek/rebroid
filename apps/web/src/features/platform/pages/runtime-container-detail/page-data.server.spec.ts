import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actionError, actionOk, type ActionResult } from '@/shared/actions/action-result'
import { loadRuntimeContainerDetailPageData } from './page-data.server'

const { getContainer, getSummary, getLogs, requireAdmin } = vi.hoisted(() => ({
  getContainer: vi.fn(),
  getSummary: vi.fn(),
  getLogs: vi.fn(),
  requireAdmin: vi.fn()
}))
vi.mock('@/server/auth/authorization', () => ({ requireAdmin }))
vi.mock('@/server/orchestrator/platform/client', () => ({
  orchestratorPlatformClient: { getPlatformContainerSummary: getSummary }
}))
vi.mock('@/server/orchestrator/platform/container-actions', () => ({
  getPlatformContainerAction: getContainer,
  getPlatformContainerLogsAction: getLogs
}))

describe('container section loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getContainer.mockResolvedValue({ container: { names: ['runtime'], shortId: 'container' } })
    getSummary.mockResolvedValue({ container: { id: 'container', names: ['runtime'] }, startedAt: '2026-11-25' })
    getLogs.mockResolvedValue(actionOk({ output: 'ready' }))
  })

  it('does not request logs for the overview', async () => {
    await loadRuntimeContainerDetailPageData('container')
    expect(getContainer).toHaveBeenCalledWith('container')
    expect(getSummary).not.toHaveBeenCalled()
    expect(getLogs).not.toHaveBeenCalled()
  })

  it('loads logs immediately for the logs destination', async () => {
    const result = await loadRuntimeContainerDetailPageData('container', 'logs')
    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(getSummary).toHaveBeenCalledWith('container')
    expect(getContainer).not.toHaveBeenCalled()
    expect(getLogs).toHaveBeenCalledWith('container')
    if (result.view !== 'logs') throw new Error('Expected logs data')
    await expect(result.pendingLogs).resolves.toEqual(actionOk({ output: 'ready' }))
  })

  it('returns container details while logs are pending and confines log failure to that section', async () => {
    const logs = Promise.withResolvers<ActionResult<{ output: string }>>()
    getLogs.mockReturnValueOnce(logs.promise)

    const result = await loadRuntimeContainerDetailPageData('container', 'logs')
    if (result.view !== 'logs') throw new Error('Expected logs data')
    expect(result.summary.container.names).toEqual(['runtime'])
    const failure = actionError({ message: 'Log limit exceeded', status: 413 })
    logs.resolve(failure)
    await expect(result.pendingLogs).resolves.toEqual(failure)
  })

  it('loads only the summary for Terminal', async () => {
    await expect(loadRuntimeContainerDetailPageData('container', 'terminal')).resolves.toMatchObject({
      view: 'terminal',
      summary: { startedAt: '2026-11-25' }
    })
    expect(getContainer).not.toHaveBeenCalled()
    expect(getLogs).not.toHaveBeenCalled()
  })
})
