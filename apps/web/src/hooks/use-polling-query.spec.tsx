import { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePollingQuery } from './use-polling-query'

describe('usePollingQuery', () => {
  it('can reject an explicit refresh without treating retained data as a fresh result', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue('retained')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePollingQuery('failed-refresh', fetcher), { wrapper })
    await waitFor(() => expect(result.current.data).toBe('retained'))
    fetcher.mockRejectedValue(new Error('Offline'))
    await act(async () => {
      await expect(result.current.mutate({ throwOnError: true })).rejects.toThrow('Offline')
    })
    expect(result.current.data).toBe('retained')
    await act(async () => {
      // Existing callers retain their nonthrowing refresh contract.
      expect(await result.current.mutate()).toBe('retained')
    })
    queryClient.clear()
  })

  it('keeps array, string, and disabled keys in separate cache entries', async () => {
    const client = new QueryClient()
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({
        array: usePollingQuery(['same'], () => Promise.resolve('array')).data,
        text: usePollingQuery('["same"]', () => Promise.resolve('text')).data,
        literal: usePollingQuery('disabled', () => Promise.resolve('literal')).data,
        absent: usePollingQuery(null, () => Promise.resolve('unused')).data
      }),
      { wrapper }
    )
    await waitFor(() =>
      expect(result.current).toEqual({ array: 'array', text: 'text', literal: 'literal', absent: undefined })
    )
    client.clear()
  })

  it('keeps a confirmed write when an earlier read completes late', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue('initial')
    const client = new QueryClient()
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePollingQuery('limits', fetcher), { wrapper })
    await waitFor(() => expect(result.current.data).toBe('initial'))
    let finish!: (value: string) => void
    fetcher.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve
      })
    )
    await act(async () => {
      const pending = result.current.mutate()
      const saving = result.current.replaceData('saved')
      finish('outdated')
      await Promise.all([pending, saving])
    })
    await waitFor(() => expect(result.current.data).toBe('saved'))
    client.clear()
  })

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
