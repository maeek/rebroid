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
