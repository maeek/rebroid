import { act, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SessionStatusMonitor } from './session-status-monitor'

it('cancels an in-flight session check on unmount and coalesces focus events', () => {
  const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetch)
  try {
    const { unmount } = render(<SessionStatusMonitor />)
    act(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/session-status')
    expect(options?.cache).toBe('no-store')
    const signal = options?.signal
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})
