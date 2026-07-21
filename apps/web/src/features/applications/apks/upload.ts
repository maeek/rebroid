import { uploadFormDataWithProgress } from '@/lib/http/upload-form-data-with-progress'
import type { UploadedApk } from '@/shared/contracts/application'

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
