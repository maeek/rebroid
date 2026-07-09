import { NextRequest, NextResponse } from 'next/server'
import 'server-only'

interface StreamingUploadOptions {
  maxBytes: number
  multipartOverheadBytes?: number
  missingMessage: string
  tooLargeMessage: string
}

export class StreamingUploadTooLargeError extends Error {}

const enforceStreamingLimit = (body: ReadableStream<Uint8Array>, maximumBytes: number, message: string) => {
  const reader = body.getReader()
  let receivedBytes = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read()
        if (chunk.done) {
          controller.close()
          return
        }
        receivedBytes += chunk.value.byteLength
        if (receivedBytes > maximumBytes) {
          await reader.cancel(message)
          controller.error(new StreamingUploadTooLargeError(message))
          return
        }
        controller.enqueue(chunk.value)
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    }
  })
}

export const prepareStreamingMultipartUpload = (
  request: NextRequest,
  options: StreamingUploadOptions
): { ok: true; body: ReadableStream<Uint8Array>; contentType: string } | { ok: false; response: NextResponse } => {
  const contentLength = Number(request.headers.get('content-length'))
  const maximumRequestBytes = options.maxBytes + (options.multipartOverheadBytes ?? 1024 * 1024)
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return {
      ok: false,
      response: NextResponse.json({ message: options.tooLargeMessage }, { status: 413 })
    }
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !request.body) {
    return {
      ok: false,
      response: NextResponse.json({ message: options.missingMessage }, { status: 400 })
    }
  }

  return {
    ok: true,
    body: enforceStreamingLimit(request.body, maximumRequestBytes, options.tooLargeMessage),
    contentType
  }
}
