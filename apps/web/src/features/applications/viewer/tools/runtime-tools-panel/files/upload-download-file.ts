import { uploadFormDataWithProgress } from '@/lib/http/upload-form-data-with-progress'
import { isActionResult, unwrapActionResult } from '@/shared/actions/action-result'
import type { ApplicationRuntimeFileUpload } from '@/shared/contracts/application'

type UploadDownloadFileOptions = {
  appId: string
  file: File
  path: string
  onProgress?: (progress: number) => void
  overwrite?: boolean
  signal?: AbortSignal
}

export const uploadDownloadFileWithProgress = ({
  appId,
  file,
  path,
  onProgress,
  overwrite = false,
  signal
}: UploadDownloadFileOptions) => {
  const body = new FormData()
  body.set('file', file)
  const query = new URLSearchParams({ path, overwrite: String(overwrite) })

  return uploadFormDataWithProgress<unknown>({
    body,
    failureMessage: 'File upload failed.',
    onProgress,
    signal,
    timeoutMessage: 'File upload timed out.',
    timeoutMs: 5 * 60 * 1000,
    url: `/api/bff/applications/${encodeURIComponent(appId)}/runtime/files/upload?${query.toString()}`
  }).then(result => {
    if (!isActionResult<ApplicationRuntimeFileUpload>(result)) {
      throw new Error('The upload service returned an invalid response.')
    }
    return unwrapActionResult(result)
  })
}
