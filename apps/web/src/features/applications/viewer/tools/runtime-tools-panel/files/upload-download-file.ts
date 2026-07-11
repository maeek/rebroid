import { uploadFormDataWithProgress } from '@/lib/http/upload-form-data-with-progress'
import type { ApplicationRuntimeFileUpload } from '@/server/orchestrator/applications/types'

type UploadDownloadFileOptions = {
  appId: string
  file: File
  path: string
  onProgress?: (progress: number) => void
}

export const uploadDownloadFileWithProgress = ({ appId, file, path, onProgress }: UploadDownloadFileOptions) => {
  const body = new FormData()
  body.set('file', file)
  const query = new URLSearchParams({ path })

  return uploadFormDataWithProgress<ApplicationRuntimeFileUpload>({
    body,
    failureMessage: 'File upload failed.',
    onProgress,
    timeoutMessage: 'File upload timed out.',
    timeoutMs: 5 * 60 * 1000,
    url: `/api/applications/${encodeURIComponent(appId)}/downloads/upload?${query.toString()}`
  })
}
