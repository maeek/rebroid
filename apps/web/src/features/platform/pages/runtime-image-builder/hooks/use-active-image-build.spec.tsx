import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { useActiveImageBuild } from './use-active-image-build'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
const job = { id: 'job-1', status: 'running' } as ContainerImageBuildJob
describe('active image build', () => {
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
    const { result } = renderHook(() => useActiveImageBuild(job))
    act(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(5000)
    })
    expect(getBff).toHaveBeenCalledTimes(1)
    vi.mocked(sendBff).mockResolvedValue({ ...job, status: 'cancelled' })
    await act(() => result.current.cancelBuild())
    await act(async () => {
      finish(job)
      await Promise.resolve()
    })
    expect(result.current.activeJob?.status).toBe('cancelled')
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
    const { result } = renderHook(() => useActiveImageBuild(job))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    vi.mocked(sendBff).mockResolvedValue({ ...job, status: 'cancelled' })
    await act(() => result.current.cancelBuild())
    await act(() =>
      result.current.startBuild(() => Promise.resolve({ ...job, id: 'job-2', status: 'queued' }), 'Build started')
    )
    await act(async () => {
      finish(job)
      await Promise.resolve()
    })
    expect(result.current.activeJob?.id).toBe('job-2')
  })
  it('blocks a second cancel and a replacement while cancellation is pending', async () => {
    let cancel!: (value: ContainerImageBuildJob) => void
    vi.mocked(sendBff).mockImplementation(
      () =>
        new Promise(resolve => {
          cancel = resolve
        })
    )
    vi.mocked(getBff).mockResolvedValue({ ...job, status: 'succeeded' })
    const start = vi.fn().mockResolvedValue({ ...job, id: 'job-2', status: 'queued' })
    const { result } = renderHook(() => useActiveImageBuild(job))

    act(() => {
      void result.current.cancelBuild()
      void result.current.cancelBuild()
    })
    expect(sendBff).toHaveBeenCalledTimes(1)
    await act(() => {
      window.dispatchEvent(new Event('focus'))
      return Promise.resolve()
    })
    expect(result.current.activeJob?.status).toBe('succeeded')
    await act(() => result.current.startBuild(start, 'Build started'))
    expect(start).not.toHaveBeenCalled()

    await act(() => {
      cancel({ ...job, status: 'cancelled' })
      return Promise.resolve()
    })
    expect(result.current.activeJob?.status).toBe('succeeded')
    await act(() => result.current.startBuild(start, 'Build started'))
    expect(result.current.activeJob?.id).toBe('job-2')
  })
})
