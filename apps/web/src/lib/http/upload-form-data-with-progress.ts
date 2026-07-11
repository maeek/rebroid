interface UploadFormDataWithProgressOptions {
  body: FormData
  failureMessage: string
  onProgress?: (progress: number) => void
  timeoutMessage?: string
  timeoutMs?: number
  url: string
}

const hasResponseMessage = (value: unknown): value is { message: unknown } =>
  value !== null && typeof value === 'object' && 'message' in value

const normalizeResponseMessage = (message: unknown) => (Array.isArray(message) ? message.join(', ') : message)

const responseErrorMessage = (value: unknown, fallback: string) => {
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
  timeoutMessage,
  timeoutMs,
  url
}: UploadFormDataWithProgressOptions) =>
  new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.responseType = 'json'
    if (timeoutMs) {
      request.timeout = timeoutMs
    }
    request.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(request.response as Response)
        return
      }

      reject(new Error(responseErrorMessage(request.response, failureMessage)))
    }
    request.onerror = () => reject(new Error(failureMessage))
    request.ontimeout = () => reject(new Error(timeoutMessage ?? `${failureMessage.replace(/\.$/, '')} timed out.`))
    request.send(body)
  })
