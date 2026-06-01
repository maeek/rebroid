import { PropsWithChildren } from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { usePollingQuery } from './use-polling-query'

describe('usePollingQuery', () => {
  it('deduplicates concurrent reads with the same key', async () => {
    const fetcher = jest.fn<() => Promise<string>>().mockResolvedValue('value')
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
