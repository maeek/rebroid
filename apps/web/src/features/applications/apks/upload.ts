import { uploadFormDataWithProgress } from '@/features/applications/upload-form-data-with-progress'
import type { UploadedApk } from '@/server/orchestrator/applications/types'

type UploadApkOptions = {
  file: File
  onProgress?: (progress: number) => void
}

export const uploadApkWithProgress = ({ file, onProgress }: UploadApkOptions) => {
  const body = new FormData()
  body.set('apk', file)

  return uploadFormDataWithProgress<UploadedApk>({
    body,
    failureMessage: 'APK upload failed.',
    onProgress,
    url: '/api/apks/upload'
  })
}
