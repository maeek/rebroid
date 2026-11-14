import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useImmediateSave } from './use-immediate-save'

afterEach(() => vi.useRealTimers())

it('confirms only acknowledged saves and blocks duplicate admission', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(useImmediateSave)
  const commit = Promise.withResolvers<void>()
  let saving: Promise<void>
  act(() => {
    saving = result.current.save('feature', () => commit.promise)
  })
  expect(result.current.pendingId).toBe('feature')
  expect(result.current.savedId).toBeNull()
  const duplicate = vi.fn()
  await act(() => result.current.save('feature', duplicate))
  expect(duplicate).not.toHaveBeenCalled()
  await act(async () => {
    commit.resolve()
    await saving
  })
  expect(result.current.pendingId).toBeNull()
  expect(result.current.savedId).toBe('feature')
  act(() => {
    vi.advanceTimersByTime(1200)
  })
  expect(result.current.savedId).toBeNull()
})

it('clears the previous confirmation on a failed attempt and allows retry', async () => {
  const { result } = renderHook(useImmediateSave)
  await act(() => result.current.save('task', () => Promise.resolve()))
  await act(async () => {
    await expect(result.current.save('task', () => Promise.reject(new Error('Offline')))).rejects.toThrow('Offline')
  })
  expect(result.current.pendingId).toBeNull()
  expect(result.current.savedId).toBeNull()
  await act(() => result.current.save('task', () => Promise.resolve()))
  expect(result.current.savedId).toBe('task')
})
