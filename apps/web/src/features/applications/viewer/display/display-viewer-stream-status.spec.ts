import { describe, expect, it } from '@jest/globals'
import { isDisplayViewerStreamStatus, viewerStreamStatusMessageType } from './display-viewer-stream-status'

describe('display viewer stream status messages', () => {
  it('accepts a valid stream status message', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'audio-disabled',
        severity: 'info',
        blocking: false,
        message: 'Audio capture is disabled for this stream.',
        transport: 'websocket'
      })
    ).toBe(true)
  })

  it('rejects unknown status codes', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'other',
        severity: 'info',
        blocking: false,
        message: 'Unknown status'
      })
    ).toBe(false)
  })

  it('rejects malformed payloads', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'reconnecting',
        severity: 'warning',
        blocking: 'no',
        message: 'Reconnecting live display...'
      })
    ).toBe(false)
  })
})
