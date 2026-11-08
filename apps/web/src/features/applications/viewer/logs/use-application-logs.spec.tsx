import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/actions/runtime/log-actions'
import { useApplicationLogs } from './use-application-logs'

vi.mock('@/server/orchestrator/applications/actions/runtime/log-actions', () => ({ getApplicationLogsAction: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
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
})
