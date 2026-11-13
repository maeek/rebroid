import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/actions/runtime/log-actions'
import { useApplicationLogs } from './use-application-logs'
import type { ApplicationLog } from '@/shared/contracts/application'

vi.mock('@/server/orchestrator/applications/actions/runtime/log-actions', () => ({ getApplicationLogsAction: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
const clients: QueryClient[] = []
const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
const runningApp = { ...previewApp, running: true, status: 'running' as const, containerId: 'container' }
const advance = async (milliseconds = 10) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getApplicationLogsAction).mockImplementation((_id, source) =>
    Promise.resolve({
      source,
      collectedAt: '2026-01-01',
      output: `${source} output`
    })
  )
})
afterEach(() => {
  clients.splice(0).forEach(client => client.clear())
  vi.useRealTimers()
})
describe('automatic diagnostic logs', () => {
  it('loads on entry and source change while Live remains off', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(
      () =>
        useApplicationLogs({
          app: { ...previewApp, running: true, status: 'running', containerId: 'container' },
          loadWhenEnabled: true
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.log?.output).toBe('orchestrator output'))
    expect(result.current.isLive).toBe(false)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(1)
    act(() => result.current.changeSource('container'))
    await waitFor(() => expect(result.current.log?.output).toBe('container output'))
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(2)
    expect(result.current.isLive).toBe(false)
    act(() => result.current.changeSource('orchestrator'))
    await waitFor(() => expect(result.current.log?.output).toBe('orchestrator output'))
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(3)
    client.clear()
  })

  it('replays a 7.5-second live window with three reads instead of render-triggered requests', async () => {
    vi.useFakeTimers()
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useApplicationLogs({ app: { ...runningApp }, enabled, loadWhenEnabled: true }),
      { initialProps: { enabled: true }, wrapper: createWrapper() }
    )
    await advance()
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(1)
    vi.mocked(getApplicationLogsAction).mockClear()

    act(() => result.current.setIsLive(true))
    await advance()
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(1)
    rerender({ enabled: true })
    rerender({ enabled: true })
    await advance(7500)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(3)
    expect(result.current.log?.output).toBe('orchestrator output')

    await act(async () => result.current.loadLogs())
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(4)
    rerender({ enabled: false })
    await advance(9000)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(4)
    unmount()
    await advance(9000)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(4)
  })

  it('does not let a pending refresh replace logs from a newly selected source', async () => {
    const { result } = renderHook(() => useApplicationLogs({ app: runningApp, loadWhenEnabled: true }), {
      wrapper: createWrapper()
    })
    await waitFor(() => expect(result.current.log?.output).toBe('orchestrator output'))
    let resolve!: (log: ApplicationLog) => void
    vi.mocked(getApplicationLogsAction).mockReturnValueOnce(new Promise<ApplicationLog>(done => (resolve = done)))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.loadLogs()
    })
    act(() => result.current.changeSource('container'))
    await waitFor(() => expect(result.current.log?.output).toBe('container output'))
    await act(async () => {
      resolve({ source: 'orchestrator', collectedAt: '2026-01-02', output: 'late old source' })
      await pending
    })
    expect(result.current.log?.output).toBe('container output')
  })

  it('stops live polling after a read fails', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useApplicationLogs({ app: runningApp }), { wrapper: createWrapper() })
    await advance()
    vi.mocked(getApplicationLogsAction).mockRejectedValueOnce(new Error('ADB unavailable'))
    act(() => result.current.setIsLive(true))
    await advance()
    expect(result.current.isLive).toBe(false)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(2)
    await advance(9000)
    expect(getApplicationLogsAction).toHaveBeenCalledTimes(2)
  })
})
