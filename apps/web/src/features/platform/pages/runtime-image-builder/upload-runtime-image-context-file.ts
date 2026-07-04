import { uploadFormDataWithProgress } from '@/features/applications/upload-form-data-with-progress'
import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'

export const uploadRuntimeImageContextFile = ({
  contextPath,
  file,
  onProgress
}: {
  contextPath: string
  file: File
  onProgress?: (progress: number) => void
}) => {
  const body = new FormData()
  body.set('file', file)

  const query = new URLSearchParams({ contextPath })
  return uploadFormDataWithProgress<ContainerImageBuildContextFile>({
    body,
    failureMessage: 'Build context upload failed.',
    onProgress,
    url: `/api/runtime-images/build-context/upload?${query.toString()}`
  })
}
