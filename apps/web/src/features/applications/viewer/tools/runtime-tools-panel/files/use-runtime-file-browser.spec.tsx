import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRuntimeFileBrowser } from './use-runtime-file-browser'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const mocks = vi.hoisted(() => ({ getBff: vi.fn(), toast: vi.fn() }))

vi.mock('@/lib/http/bff', () => ({ getBff: mocks.getBff }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
vi.mock('@/server/orchestrator/applications/actions/runtime/file-actions', () => ({
  createApplicationRuntimeDirectoryAction: vi.fn(),
  deleteApplicationRuntimeFileAction: vi.fn(),
  downloadApplicationRuntimeFileAction: vi.fn(),
  renameApplicationRuntimeFileAction: vi.fn()
}))

const folder = (name: string, path: string): ApplicationRuntimeFile => ({
  name,
  path,
  type: 'directory',
  sizeBytes: null,
  itemCount: null,
  modifiedAt: null
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(onResolve => {
    resolve = onResolve
  })
  return { promise, resolve }
}

describe('useRuntimeFileBrowser', () => {
  let queryClient: QueryClient
  let wrapper: (props: PropsWithChildren) => React.ReactNode

  beforeEach(() => {
    mocks.getBff.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  })

  it('updates the path immediately and ignores an obsolete folder response', async () => {
    const rootRequest = deferred<ApplicationRuntimeFile[]>()
    const picturesRequest = deferred<ApplicationRuntimeFile[]>()
    let rootSignal: AbortSignal | undefined
    mocks.getBff.mockImplementation((url: string, signal: AbortSignal) => {
      if (url.includes(encodeURIComponent('/data/Pictures'))) return picturesRequest.promise
      rootSignal = signal
      return rootRequest.promise
    })
    const { result } = renderHook(
      () => useRuntimeFileBrowser({ appId: 'app-1', canTransferFiles: true, runtimeAvailable: true }),
      { wrapper }
    )
    await waitFor(() => expect(mocks.getBff).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.setSearchQuery('photo')
      result.current.navigateTo('/data/Pictures')
    })
    expect(result.current.currentPath).toBe('/data/Pictures')
    expect(result.current.searchQuery).toBe('')
    await waitFor(() => expect(mocks.getBff).toHaveBeenCalledTimes(2))
    expect(rootSignal?.aborted).toBe(true)

    act(() => picturesRequest.resolve([folder('Screenshots', '/data/Pictures/Screenshots')]))
    await waitFor(() => expect(result.current.files.map(entry => entry.name)).toEqual(['Screenshots']))
    act(() => rootRequest.resolve([folder('Documents', '/data/Documents')]))
    expect(result.current.currentPath).toBe('/data/Pictures')
    expect(result.current.files.map(entry => entry.name)).toEqual(['Screenshots'])
  })

  it('renders an exact-path cache immediately on back navigation and prefetches tree intent', async () => {
    mocks.getBff.mockImplementation((url: string) => {
      if (url.includes(encodeURIComponent('/data/Documents'))) {
        return [folder('Reports', '/data/Documents/Reports')]
      }
      if (url.includes(encodeURIComponent('/data/Pictures'))) {
        return [folder('Screenshots', '/data/Pictures/Screenshots')]
      }
      return [folder('Documents', '/data/Documents')]
    })
    const { result } = renderHook(
      () => useRuntimeFileBrowser({ appId: 'app-1', canTransferFiles: true, runtimeAvailable: true }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.files.map(entry => entry.name)).toEqual(['Documents']))

    act(() => result.current.navigateTo('/data/Documents'))
    await waitFor(() => expect(result.current.files.map(entry => entry.name)).toEqual(['Reports']))
    act(() => result.current.navigateTo('/data'))
    expect(result.current.files.map(entry => entry.name)).toEqual(['Documents'])

    await act(async () => result.current.prefetchPath('/data/Pictures'))
    expect(queryClient.getQueryData(['runtime-files', 'app-1', '/data/Pictures'])).toEqual([
      folder('Screenshots', '/data/Pictures/Screenshots')
    ])
  })
})
