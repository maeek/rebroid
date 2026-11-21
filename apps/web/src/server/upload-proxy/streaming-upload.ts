import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'

const multipartOverheadBytes = 1024 * 1024

interface StreamingUploadOptions {
  maxBytes: number
  missingMessage: string
  tooLargeMessage: string
}

export const enforceStreamingLimit = (body: ReadableStream<Uint8Array>, maximumBytes: number, message: string) => {
  let receivedBytes = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength
        if (receivedBytes > maximumBytes) {
          throw new PublicActionError(message, { code: 'validation', status: 413 })
        }
        controller.enqueue(chunk)
      }
    })
  )
}

export const prepareStreamingMultipartUpload = (
  request: Pick<Request, 'body' | 'headers'>,
  options: StreamingUploadOptions
) => {
  const contentLength = Number(request.headers.get('content-length'))
  const maximumRequestBytes = options.maxBytes + multipartOverheadBytes
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    throw new PublicActionError(options.tooLargeMessage, { code: 'validation', status: 413 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !request.body) {
    throw new PublicActionError(options.missingMessage, { code: 'validation', status: 400 })
  }

  return {
    body: enforceStreamingLimit(request.body, maximumRequestBytes, options.tooLargeMessage),
    contentType
  }
}
