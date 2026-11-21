import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  viewerControlCommandEventType,
  type ViewerControlCommandEventDetail
} from '@/features/applications/viewer/player/viewer-keyboard-relay'
import { toast } from '@/hooks/use-toast'
import { sendApplicationViewerControlAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { useViewerControlSender } from './use-viewer-control-sender'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/runtime/viewer-actions', () => ({
  sendApplicationViewerControlAction: vi.fn()
}))

const listenForCommands = () => {
  const sent: ViewerControlCommandEventDetail[] = []
  const listener = (event: Event) => {
    const command = event as CustomEvent<ViewerControlCommandEventDetail>
    command.preventDefault()
    sent.push(command.detail)
  }
  window.addEventListener(viewerControlCommandEventType, listener)
  const finish = (index: number, error?: string) =>
    act(() => {
      sent[index]?.onResult?.(error)
      return Promise.resolve()
    })
  return { sent, finish, stop: () => window.removeEventListener(viewerControlCommandEventType, listener) }
}

it('queues repeated volume taps and other commands in order while showing command-scoped pending', async () => {
  const { sent, finish, stop } = listenForCommands()
  try {
    const { result } = renderHook(() =>
      useViewerControlSender({ appId: 'app', baseControlsDisabled: false, surfaceId: 'main' })
    )
    act(() => {
      result.current.sendControl('volume-up')
      result.current.sendControl('volume-up')
      result.current.sendControl('home')
      result.current.sendControl('home')
    })
    expect(result.current.isCommandPending('home')).toBe(true)
    expect(result.current.commandDisabled('back')).toBe(false)
    expect(result.current.commandDisabled('volume-up')).toBe(false)
    expect(sent.map(item => item.command)).toEqual(['volume-up'])

    await finish(0)
    await finish(1)
    expect(sent.map(item => item.command)).toEqual(['volume-up', 'volume-up', 'home'])
    await finish(2)
    expect(result.current.isCommandPending('home')).toBe(false)
  } finally {
    stop()
  }
})

it('drops pending commands after an uncertain result or a replacement frame', async () => {
  const { sent, finish, stop } = listenForCommands()
  try {
    const { result, rerender } = renderHook(
      ({ frameKey }) =>
        useViewerControlSender({ appId: 'app', baseControlsDisabled: false, surfaceId: 'main', frameKey }),
      { initialProps: { frameKey: 'first' } }
    )
    act(() => {
      result.current.sendControl('home')
      result.current.sendControl('back')
    })
    await finish(0, 'The viewer did not confirm the command.')
    expect(vi.mocked(toast).mock.lastCall?.[0].description).toContain('pending commands were cleared')
    expect(result.current.isCommandPending('back')).toBe(false)
    expect(sent).toHaveLength(1)

    act(() => {
      result.current.sendControl('rotate')
      result.current.sendControl('volume-up')
    })
    rerender({ frameKey: 'replacement' })
    await finish(1)
    expect(result.current.isCommandPending('volume-up')).toBe(false)
    expect(sent.map(item => item.command)).toEqual(['home', 'rotate'])
  } finally {
    stop()
  }
})

it('discards queued commands when their display route disappears', async () => {
  const { finish, stop } = listenForCommands()
  try {
    const { result } = renderHook(() =>
      useViewerControlSender({ appId: 'app', baseControlsDisabled: false, surfaceId: 'main' })
    )
    act(() => {
      result.current.sendControl('home')
      result.current.sendControl('back')
    })
    stop()
    await finish(0)
    expect(result.current.isCommandPending('back')).toBe(false)
    expect(sendApplicationViewerControlAction).not.toHaveBeenCalled()
  } finally {
    stop()
  }
})
