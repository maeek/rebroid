import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  keyboardEventMessageType,
  viewerControlCommandEventType,
  viewerControlMessageType,
  viewerControlResultMessageType
} from '../player/viewer-keyboard-relay'
import { DisplayViewerFrame } from './display-viewer-frame'

it('routes parent keyboard input to one active display and correlates a targeted control result', () => {
  const frames = (active: 'main' | 'virtual') => (
    <>
      <DisplayViewerFrame
        src='/viewer/main'
        surfaceId='main'
        isActive={active === 'main'}
        keyboardCaptureEnabled
      />
      <DisplayViewerFrame
        src='/viewer/virtual'
        surfaceId='virtual'
        isActive={active === 'virtual'}
        keyboardCaptureEnabled
      />
    </>
  )
  const { rerender } = render(frames('main'))
  const [main, virtual] = screen.getAllByTitle<HTMLIFrameElement>('display viewer')
  const mainWindow = main.contentWindow!
  const virtualWindow = virtual.contentWindow!
  const mainPost = vi.spyOn(mainWindow, 'postMessage')
  const virtualPost = vi.spyOn(virtualWindow, 'postMessage')
  const record = (message: unknown) => message as { type?: string; requestId?: string; eventType?: string }
  const keyMessages = (spy: typeof mainPost) =>
    spy.mock.calls.filter(([message]) => record(message).type === keyboardEventMessageType)

  fireEvent.keyDown(window, { code: 'KeyA', key: 'a' })
  expect(keyMessages(mainPost)).toHaveLength(1)
  expect(keyMessages(virtualPost)).toHaveLength(0)
  rerender(frames('virtual'))
  fireEvent.keyDown(window, { code: 'KeyB', key: 'b' })
  expect(keyMessages(mainPost).map(([message]) => record(message).eventType)).toEqual(['keydown', 'keyup'])
  expect(keyMessages(virtualPost)).toHaveLength(1)
  fireEvent.keyUp(window, { code: 'KeyA', key: 'a' })
  expect(keyMessages(virtualPost)).toHaveLength(1)

  const onResult = vi.fn()
  const command = new CustomEvent(viewerControlCommandEventType, {
    cancelable: true,
    detail: { command: 'home', surfaceId: 'virtual', onResult }
  })
  expect(window.dispatchEvent(command)).toBe(false)
  const outgoing = virtualPost.mock.calls
    .map(([message]) => record(message))
    .find(message => message.type === viewerControlMessageType)
  expect(outgoing?.requestId).toBeDefined()
  const reply = (source: Window) => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source,
        data: { type: viewerControlResultMessageType, requestId: outgoing?.requestId, ok: true }
      })
    )
  }
  reply(mainWindow)
  expect(onResult).not.toHaveBeenCalled()
  reply(virtualWindow)
  expect(onResult).toHaveBeenCalledOnce()
})

it('toggles compact presentation without replacing the frame and blocks its commands', () => {
  const frame = (compact: boolean) => (
    <DisplayViewerFrame
      src='/viewer/main'
      surfaceId='main'
      keyboardCaptureEnabled
      compact={compact}
    />
  )
  const { rerender } = render(frame(false))
  const viewer = screen.getByTitle<HTMLIFrameElement>('display viewer')
  const post = vi.spyOn(viewer.contentWindow!, 'postMessage')

  rerender(frame(true))
  expect(screen.getByTitle('display viewer')).toBe(viewer)
  expect(viewer).toHaveAttribute('data-viewer-compact')
  expect(post).toHaveBeenCalledWith(
    { type: 'rebroid-viewer-presentation', compact: true, minimizeShortcutEnabled: false },
    window.location.origin
  )
  const send = (surfaceId?: string) =>
    window.dispatchEvent(
      new CustomEvent(viewerControlCommandEventType, {
        cancelable: true,
        detail: { command: 'home', surfaceId }
      })
    )
  expect(send()).toBe(true)
  expect(send('main')).toBe(true)

  rerender(frame(false))
  expect(screen.getByTitle('display viewer')).toBe(viewer)
  expect(viewer).not.toHaveAttribute('data-viewer-compact')
  expect(send('main')).toBe(false)
})

it('accepts the minimize shortcut only from its own frame when keyboard capture is off', () => {
  const onMinimizeShortcut = vi.fn()
  const frame = (keyboardCaptureEnabled: boolean) => (
    <DisplayViewerFrame
      src='/viewer/main'
      keyboardCaptureEnabled={keyboardCaptureEnabled}
      onMinimizeShortcut={onMinimizeShortcut}
    />
  )
  const { rerender } = render(frame(false))
  const viewer = screen.getByTitle<HTMLIFrameElement>('display viewer')
  const reportShortcut = (source: Window, origin: string) =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source,
        origin,
        data: { type: 'rebroid-viewer-minimize-shortcut' }
      })
    )

  reportShortcut(window, window.location.origin)
  reportShortcut(viewer.contentWindow!, 'https://untrusted.example')
  expect(onMinimizeShortcut).not.toHaveBeenCalled()

  reportShortcut(viewer.contentWindow!, window.location.origin)
  expect(onMinimizeShortcut).toHaveBeenCalledOnce()

  rerender(frame(true))
  reportShortcut(viewer.contentWindow!, window.location.origin)
  expect(onMinimizeShortcut).toHaveBeenCalledOnce()
})
