import type { UploadedApk } from '@/server/orchestrator/applications/types'

type UploadApkOptions = {
  file: File
  onProgress?: (progress: number) => void
}

const errorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('message' in value)) {
    return 'APK upload failed.'
  }

  const message = value.message
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : 'APK upload failed.'
}

export const sha256File = async (file: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export const lookupUploadedApk = async (sha256: string) => {
  const response = await fetch(`/api/apks/lookup?${new URLSearchParams({ sha256 }).toString()}`, {
    cache: 'no-store'
  })
  if (!response.ok) {
    return null
  }

  return (await response.json()) as UploadedApk | null
}

export const uploadApkWithProgress = ({ file, onProgress }: UploadApkOptions) =>
  new Promise<UploadedApk>((resolve, reject) => {
    const body = new FormData()
    body.set('apk', file)

    const request = new XMLHttpRequest()
    request.open('POST', '/api/apks/upload')
    request.responseType = 'json'
    request.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(request.response as UploadedApk)
        return
      }

      reject(new Error(errorMessage(request.response)))
    }
    request.onerror = () => reject(new Error('APK upload failed.'))
    request.send(body)
  })
