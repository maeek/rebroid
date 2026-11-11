import { describe, expect, it, vi } from 'vitest'
import { readAutomationDraftStream } from './read-automation-draft-stream'

const encoder = new TextEncoder()
const streamFromChunks = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    }
  })

describe('readAutomationDraftStream', () => {
  it('reads progress and clarification through split UTF-8 and CRLF frames', async () => {
    const bytes = encoder.encode(
      'data: {"type":"draft.started","message":"Starting"}\r\n\r\n' +
        'data: {"type":"draft.clarification.requested","message":"Clarification","data":{"question":"Which café?"}}\r\n\r\n'
    )
    const onEvent = vi.fn<(event: { type: string }) => void>()
    const outcome = await readAutomationDraftStream(streamFromChunks(Array.from(bytes, byte => Uint8Array.of(byte))), {
      onEvent
    })
    expect(outcome).toEqual({ type: 'draft.clarification.requested', question: 'Which café?' })
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual(['draft.started', 'draft.clarification.requested'])
  })

  it('rejects a malformed completed event', async () => {
    const stream = streamFromChunks([
      encoder.encode('data: {"type":"draft.completed","message":"Ready","data":{}}\n\n')
    ])
    await expect(readAutomationDraftStream(stream)).rejects.toThrow('invalid draft')
  })

  it('rejects a stream that closes without a terminal event', async () => {
    await expect(readAutomationDraftStream(streamFromChunks([]))).rejects.toThrow('ended without a completed draft')
  })

  it('cancels an outstanding body read', async () => {
    const cancel = vi.fn()
    const controller = new AbortController()
    const stream = new ReadableStream<Uint8Array>({ cancel })
    const pending = readAutomationDraftStream(stream, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
  })
})
