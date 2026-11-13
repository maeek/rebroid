import { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePollingQuery } from './use-polling-query'

describe('usePollingQuery', () => {
  it('deduplicates concurrent reads with the same key', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue('value')
    const queryClient = new QueryClient()
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(
      () => {
        usePollingQuery('shared-key', fetcher)
        usePollingQuery('shared-key', fetcher)
      },
      { wrapper }
    )

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    queryClient.clear()
  })

  it('keeps refresh stable across query updates and joins an in-flight refresh', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue('initial')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(() => usePollingQuery(['stable-key'], fetcher), { wrapper })
    const refresh = result.current.mutate
    await waitFor(() => expect(result.current.data).toBe('initial'))
    expect(result.current.mutate).toBe(refresh)
    rerender()
    expect(result.current.mutate).toBe(refresh)

    let resolve!: (value: string) => void
    fetcher.mockReturnValueOnce(new Promise<string>(done => (resolve = done)))
    let first!: Promise<string | undefined>
    let second!: Promise<string | undefined>
    act(() => {
      first = result.current.mutate()
      second = result.current.mutate()
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => {
      resolve('refreshed')
      expect(await first).toBe('refreshed')
      expect(await second).toBe('refreshed')
    })
    await waitFor(() => expect(result.current.data).toBe('refreshed'))
    expect(result.current.mutate).toBe(refresh)
    queryClient.clear()
  })
})
