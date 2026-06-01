import { PropsWithChildren } from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import { renderHook, waitFor } from '@testing-library/react'
import { usePollingQuery } from './use-polling-query'

describe('usePollingQuery', () => {
  it('deduplicates concurrent reads with the same key', async () => {
    const fetcher = jest.fn<() => Promise<string>>().mockResolvedValue('value')
    const wrapper = ({ children }: PropsWithChildren) => children

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
