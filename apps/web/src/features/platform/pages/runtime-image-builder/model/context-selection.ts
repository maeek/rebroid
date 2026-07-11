import type { ResolvedContextReference } from '../dockerfile-context'
import type { BadgeProps } from '@/components/ui/badge'
import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'
import type { ContainerImageBuildStatus } from '@/shared/contracts/platform-image-build'

type BadgeVariant = BadgeProps['variant']

export const terminalBuildStatuses: ContainerImageBuildStatus[] = ['succeeded', 'failed', 'cancelled']

export const maxSelectedContextFiles = 200

export const directoryInputProps = {
  directory: '',
  webkitdirectory: ''
}

export const mergeContextFiles = (
  currentFiles: ContainerImageBuildContextFile[],
  uploadedFiles: ContainerImageBuildContextFile[]
) => {
  if (uploadedFiles.length === 0) {
    return currentFiles
  }

  const existingIds = new Set(currentFiles.map(file => file.id))
  return [...uploadedFiles.filter(file => !existingIds.has(file.id)), ...currentFiles]
}

export const detectedContextStatusVariant = (status: ResolvedContextReference['status']): BadgeVariant => {
  if (status === 'selected') return 'success'
  if (status === 'missing') return 'danger'
  if (status === 'unsupported') return 'warning'
  return 'neutral'
}
