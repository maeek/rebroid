import { afterEach, expect, it, vi } from 'vitest'
import { getBff, sendBff } from './bff'

afterEach(() => vi.unstubAllGlobals())

it.each([
  (signal: AbortSignal) => getBff('/api/bff/test', signal),
  (signal: AbortSignal) => sendBff('/api/bff/test', {}, 'POST', signal)
])('preserves cancellation through response body consumption', async request => {
  const controller = new AbortController()
  const entered = Promise.withResolvers<void>()
  const body = Promise.withResolvers<unknown>()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      json() {
        entered.resolve()
        return body.promise
      }
    }))
  )
  const pending = request(controller.signal)
  await entered.promise
  const reason = new Error('View closed')
  controller.abort(reason)
  body.reject(reason)
  await expect(pending).rejects.toBe(reason)
})
