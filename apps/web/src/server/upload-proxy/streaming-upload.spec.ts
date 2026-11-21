import { describe, expect, it } from 'vitest'
import { enforceStreamingLimit, prepareStreamingMultipartUpload } from './streaming-upload'

const request = (body: Request['body'], headers: Record<string, string>) => ({
  body,
  headers: new Headers(headers)
})

const options = {
  maxBytes: 4,
  missingMessage: 'missing',
  tooLargeMessage: 'too large'
}

describe('prepareStreamingMultipartUpload', () => {
  it('rejects invalid content types and known oversized requests', () => {
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>()
    expect(() =>
      prepareStreamingMultipartUpload(request(body, { 'content-type': 'application/json' }), options)
    ).toThrow(expect.objectContaining({ status: 400, message: 'missing' }))

    expect(() =>
      prepareStreamingMultipartUpload(
        request(body, {
          'content-type': 'multipart/form-data; boundary=test',
          'content-length': String(1024 * 1024 + 5)
        }),
        options
      )
    ).toThrow(expect.objectContaining({ status: 413, message: 'too large' }))
  })

  it('accepts a multipart body exactly at the advertised maximum plus framing allowance', async () => {
    const size = 1024 * 1024 + options.maxBytes
    const body = new Response(new Uint8Array(size)).body
    const upload = prepareStreamingMultipartUpload(
      request(body, {
        'content-type': 'multipart/form-data; boundary=test',
        'content-length': String(size)
      }),
      options
    )
    expect((await new Response(upload.body).arrayBuffer()).byteLength).toBe(size)
  })

  it('streams chunks and stops an unknown-length oversized body', async () => {
    const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.enqueue(new Uint8Array(1024 * 1024 + 2))
      }
    })
    const prepared = prepareStreamingMultipartUpload(
      request(source, { 'content-type': 'multipart/form-data; boundary=test' }),
      options
    )

    const reader = prepared.body.getReader()
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: new Uint8Array([1, 2, 3])
    })
    await expect(reader.read()).rejects.toMatchObject({ status: 413, message: 'too large' })
  })
})

it('reports the size limit even when the source fails to cancel', async () => {
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array(5))
    },
    cancel() {
      throw new Error('source already closed')
    }
  })

  await expect(enforceStreamingLimit(source, 4, 'too large').getReader().read()).rejects.toMatchObject({
    message: 'too large'
  })
})
