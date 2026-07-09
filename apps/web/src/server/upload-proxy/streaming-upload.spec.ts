import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { beforeAll, describe, expect, it } from '@jest/globals'
import { NextRequest } from 'next/server'
import { prepareStreamingMultipartUpload, StreamingUploadTooLargeError } from './streaming-upload'

const request = (body: ReadableStream<Uint8Array> | null, headers: Record<string, string>) =>
  ({ body, headers: new Headers(headers) }) as NextRequest

const options = {
  maxBytes: 4,
  multipartOverheadBytes: 0,
  missingMessage: 'missing',
  tooLargeMessage: 'too large'
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'ReadableStream', {
    configurable: true,
    value: NodeReadableStream
  })
  Object.defineProperty(Response, 'json', {
    configurable: true,
    value: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers }
      })
  })
})

describe('prepareStreamingMultipartUpload', () => {
  it('rejects invalid content types and known oversized requests', () => {
    const body = new ReadableStream<Uint8Array>()
    const invalid = prepareStreamingMultipartUpload(request(body, { 'content-type': 'application/json' }), options)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.response.status).toBe(400)

    const oversized = prepareStreamingMultipartUpload(
      request(body, {
        'content-type': 'multipart/form-data; boundary=test',
        'content-length': '5'
      }),
      options
    )
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.response.status).toBe(413)
  })

  it('streams chunks and stops an unknown-length oversized body', async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.enqueue(new Uint8Array([4, 5, 6]))
      }
    })
    const prepared = prepareStreamingMultipartUpload(
      request(source, { 'content-type': 'multipart/form-data; boundary=test' }),
      options
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const reader = prepared.body.getReader()
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: new Uint8Array([1, 2, 3])
    })
    await expect(reader.read()).rejects.toBeInstanceOf(StreamingUploadTooLargeError)
  })
})
