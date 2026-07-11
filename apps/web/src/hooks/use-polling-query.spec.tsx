import { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
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
  })
})
