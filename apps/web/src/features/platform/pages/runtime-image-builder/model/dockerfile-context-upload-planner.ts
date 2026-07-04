import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'
import type {
  LocalBuildContextFile,
  ResolvedContextReference,
  UploadProgress,
  UploadResolvedContextResult
} from './dockerfile-context-types'

const maxSelectedContextFiles = 200

export const uploadResolvedContextReferences = async ({
  concurrency = 3,
  contextFileLimit = maxSelectedContextFiles,
  onProgress,
  resolvedReferences,
  selectedContextFileIds,
  upload
}: {
  concurrency?: number
  contextFileLimit?: number
  onProgress?: (progress: UploadProgress) => void
  resolvedReferences: ResolvedContextReference[]
  selectedContextFileIds: Set<string>
  upload: (file: LocalBuildContextFile) => Promise<ContainerImageBuildContextFile>
}): Promise<UploadResolvedContextResult> => {
  const selectedIds = new Set(selectedContextFileIds)
  const existingFileIds = new Set<string>()
  const uploadQueue = new Map<string, LocalBuildContextFile>()

  for (const item of resolvedReferences) {
    if (item.status !== 'uploadable') {
      continue
    }
    item.existingFileIds.forEach(id => existingFileIds.add(id))
    item.uploadFiles.forEach(file => uploadQueue.set(file.contextPath, file))
  }

  const selectedCountAfterExisting = selectedIds.size + [...existingFileIds].filter(id => !selectedIds.has(id)).length
  if (selectedCountAfterExisting + uploadQueue.size > contextFileLimit) {
    throw new Error(`A build can select at most ${contextFileLimit} context files.`)
  }

  existingFileIds.forEach(id => selectedIds.add(id))

  const queue = [...uploadQueue.values()]
  const uploadedFiles: ContainerImageBuildContextFile[] = []
  let completed = 0
  onProgress?.({ completed, total: queue.length })

  let cursor = 0
  const workerCount = Math.min(Math.max(1, concurrency), queue.length)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < queue.length) {
        const nextIndex = cursor
        cursor += 1
        const file = queue[nextIndex]
        if (!file) {
          continue
        }
        const uploaded = await upload(file)
        uploadedFiles.push(uploaded)
        selectedIds.add(uploaded.id)
        completed += 1
        onProgress?.({ completed, total: queue.length })
      }
    })
  )

  return { selectedIds, uploadedFiles }
}
