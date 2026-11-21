import { afterEach, expect, it, vi } from 'vitest'
import { consumeRateLimit } from './in-memory'

afterEach(() => vi.useRealTimers())

it('continues existing windows at capacity and reuses space when a shorter window expires', () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  for (let key = 0; key < 9_999; key++) consumeRateLimit(String(key), 2, 1_000)
  expect(consumeRateLimit('short', 1, 20)).toBe(true)
  expect(consumeRateLimit('waiting', 1, 10)).toBe(false)
  expect(consumeRateLimit('0', 2, 1_000)).toBe(true)
  expect(consumeRateLimit('0', 2, 1_000)).toBe(false)

  vi.setSystemTime(20)
  expect(consumeRateLimit('waiting', 1, 10)).toBe(true)
  expect(consumeRateLimit('another', 1, 100)).toBe(false)
  vi.setSystemTime(30)
  expect(consumeRateLimit('waiting', 1, 50)).toBe(true)
  expect(consumeRateLimit('another', 1, 100)).toBe(false)
  vi.setSystemTime(80)
  expect(consumeRateLimit('another', 1, 100)).toBe(true)
})
