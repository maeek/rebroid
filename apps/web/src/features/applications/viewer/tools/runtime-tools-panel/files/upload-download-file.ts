import { runtimeFileUploadLimit } from '@rebroid/android-application-core/redroid-runtime'
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

export const uploadDownloadFileWithProgress = async ({
  appId,
  file,
  path,
  onProgress,
  overwrite = false,
  signal
}: UploadDownloadFileOptions) => {
  if (file.size > runtimeFileUploadLimit.bytes) {
    throw new Error(runtimeFileUploadLimit.message)
  }
  const body = new FormData()
  body.set('file', file)
  const query = new URLSearchParams({ path, overwrite: String(overwrite) })

  const result = await uploadFormDataWithProgress<unknown>({
    body,
    failureMessage: 'File upload failed.',
    onProgress,
    signal,
    timeoutMessage: 'File upload timed out.',
    timeoutMs: 5 * 60 * 1000,
    url: `/api/bff/devices/${encodeURIComponent(appId)}/runtime/files/upload?${query.toString()}`
  })
  if (!isActionResult<ApplicationRuntimeFileUpload>(result))
    throw new Error('The upload service returned an invalid response.')
  return unwrapActionResult(result)
}
