import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { useActiveBuildPolling } from './use-active-build-polling'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))
const job = { id: 'job-1', status: 'running' } as ContainerImageBuildJob
const useJob = () => {
  const [active, setActive] = useState<ContainerImageBuildJob | null>(job)
  useActiveBuildPolling(active, setActive)
  return { active, setActive }
}
describe('active build polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())
  it('coalesces focus and interval refreshes and ignores a late response after cancellation', async () => {
    let finish!: (value: ContainerImageBuildJob) => void
    vi.mocked(getBff).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { result } = renderHook(useJob)
    act(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(5000)
    })
    expect(getBff).toHaveBeenCalledTimes(1)
    act(() => result.current.setActive({ ...job, status: 'cancelled' }))
    await act(async () => {
      finish(job)
      await Promise.resolve()
    })
    expect(result.current.active?.status).toBe('cancelled')
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(getBff).toHaveBeenCalledTimes(1)
  })
  it('does not replace another selected build with an old response', async () => {
    let finish!: (value: ContainerImageBuildJob) => void
    vi.mocked(getBff).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { result } = renderHook(useJob)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    act(() => result.current.setActive({ ...job, id: 'job-2', status: 'queued' }))
    await act(async () => {
      finish(job)
      await Promise.resolve()
    })
    expect(result.current.active?.id).toBe('job-2')
  })
})
