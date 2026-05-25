import type { ApplicationRuntimeFileUpload } from '@/server/orchestrator/applications/types'

type UploadDownloadFileOptions = {
  appId: string
  file: File
  onProgress?: (progress: number) => void
}

const errorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('message' in value)) {
    return 'File upload failed.'
  }

  const message = value.message
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : 'File upload failed.'
}

export const uploadDownloadFileWithProgress = ({ appId, file, onProgress }: UploadDownloadFileOptions) =>
  new Promise<ApplicationRuntimeFileUpload>((resolve, reject) => {
    const body = new FormData()
    body.set('file', file)

    const request = new XMLHttpRequest()
    request.open('POST', `/api/applications/${encodeURIComponent(appId)}/downloads/upload`)
    request.responseType = 'json'
    request.timeout = 5 * 60 * 1000
    request.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(request.response as ApplicationRuntimeFileUpload)
        return
      }

      reject(new Error(errorMessage(request.response)))
    }
    request.onerror = () => reject(new Error('File upload failed.'))
    request.ontimeout = () => reject(new Error('File upload timed out.'))
    request.send(body)
  })
