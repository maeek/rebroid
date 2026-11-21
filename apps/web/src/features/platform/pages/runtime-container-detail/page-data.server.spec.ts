import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actionError, actionOk, type ActionResult } from '@/shared/actions/action-result'
import { loadRuntimeContainerDetailPageData } from './page-data.server'

const { getContainer, getLogs } = vi.hoisted(() => ({ getContainer: vi.fn(), getLogs: vi.fn() }))
vi.mock('@/server/orchestrator/platform/container-actions', () => ({
  getPlatformContainerAction: getContainer,
  getPlatformContainerLogsAction: getLogs
}))

describe('container section loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getContainer.mockResolvedValue({ container: { names: ['runtime'], shortId: 'container' } })
    getLogs.mockResolvedValue(actionOk({ output: 'ready' }))
  })

  it('does not request logs for the overview', async () => {
    await loadRuntimeContainerDetailPageData('container')
    expect(getContainer).toHaveBeenCalledWith('container')
    expect(getLogs).not.toHaveBeenCalled()
  })

  it('loads logs immediately for the logs destination', async () => {
    const result = await loadRuntimeContainerDetailPageData('container', 'logs')
    expect(getLogs).toHaveBeenCalledWith('container')
    await expect(result.pendingLogs).resolves.toEqual(actionOk({ output: 'ready' }))
  })

  it('returns container details while logs are pending and confines log failure to that section', async () => {
    const logs = Promise.withResolvers<ActionResult<{ output: string }>>()
    getLogs.mockReturnValueOnce(logs.promise)

    const result = await loadRuntimeContainerDetailPageData('container', 'logs')
    expect(result.details.container.names).toEqual(['runtime'])
    const failure = actionError({ message: 'Log limit exceeded', status: 413 })
    logs.resolve(failure)
    await expect(result.pendingLogs).resolves.toEqual(failure)
  })
})
