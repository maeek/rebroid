import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    getLogs.mockResolvedValue({ output: 'ready' })
  })

  it('does not request logs for the overview', async () => {
    await loadRuntimeContainerDetailPageData('container')
    expect(getContainer).toHaveBeenCalledWith('container')
    expect(getLogs).not.toHaveBeenCalled()
  })

  it('loads logs immediately for the logs destination', async () => {
    const result = await loadRuntimeContainerDetailPageData('container', 'logs')
    expect(getLogs).toHaveBeenCalledWith('container')
    expect(result.logs).toEqual({ output: 'ready' })
  })
})
