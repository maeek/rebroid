import { ActionResultError, isActionFailure } from '@/shared/actions/action-result'

interface UploadFormDataWithProgressOptions {
  body: FormData
  failureMessage: string
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  timeoutMessage?: string
  timeoutMs?: number
  url: string
}

const hasResponseMessage = (value: unknown): value is { message: unknown } =>
  value !== null && typeof value === 'object' && 'message' in value

const normalizeResponseMessage = (message: unknown) => (Array.isArray(message) ? message.join(', ') : message)

const responseErrorMessage = (value: unknown, fallback: string) => {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message
    }
  }
  if (!hasResponseMessage(value)) {
    return fallback
  }

  const message = normalizeResponseMessage(value.message)
  return typeof message === 'string' ? message : fallback
}

export const uploadFormDataWithProgress = <Response>({
  body,
  failureMessage,
  onProgress,
  signal,
  timeoutMessage,
  timeoutMs,
  url
}: UploadFormDataWithProgressOptions) =>
  new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open('POST', url)
    request.responseType = 'json'
    if (timeoutMs) {
      request.timeout = timeoutMs
    }
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.floor((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(request.response as Response)
        return
      }

      reject(
        isActionFailure(request.response)
          ? new ActionResultError(request.response.error)
          : new Error(responseErrorMessage(request.response, failureMessage))
      )
    }
    request.onerror = () => reject(new Error(failureMessage))
    request.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'))
    request.ontimeout = () => reject(new Error(timeoutMessage ?? `${failureMessage.replace(/\.$/, '')} timed out.`))
    signal?.addEventListener('abort', abort, { once: true })
    request.onloadend = () => signal?.removeEventListener('abort', abort)
    request.send(body)
  })
