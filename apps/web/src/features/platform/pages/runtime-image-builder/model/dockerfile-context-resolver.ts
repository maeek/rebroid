import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'
import { normalizeBuildContextPath } from './dockerfile-context-path'
import type {
  DockerfileContextReference,
  LocalBuildContextFile,
  ResolvedContextReference,
  ResolvedContextReferenceStatus
} from './dockerfile-context-types'

export const resolveDockerfileContextReferences = ({
  contextFiles,
  localFiles,
  references,
  selectedContextFileIds
}: {
  contextFiles: ContainerImageBuildContextFile[]
  localFiles: LocalBuildContextFile[]
  references: DockerfileContextReference[]
  selectedContextFileIds: Set<string>
}): ResolvedContextReference[] => {
  const uploadedByPath = contextFilesByPath(contextFiles)
  const localByPath = localFilesByPath(localFiles)

  return references.map(reference => {
    if (reference.state === 'ignored') {
      return resolved(reference, 'ignored', reference.reason ?? 'Ignored by Dockerfile context import.', [], [])
    }
    if (reference.state === 'unsupported' || !reference.contextPath) {
      return resolved(reference, 'unsupported', reference.reason ?? 'Unsupported Dockerfile source.', [], [])
    }

    const uploadedMatches = matchingUploadedFiles(reference, uploadedByPath)
    const selectedUploadedMatches = uploadedMatches.filter(file => selectedContextFileIds.has(file.id))
    const unselectedUploadedMatches = uploadedMatches.filter(file => !selectedContextFileIds.has(file.id))
    const localMatches = matchingLocalFiles(
      reference,
      localByPath,
      new Set(uploadedMatches.map(file => file.contextPath))
    )

    if (selectedUploadedMatches.length > 0 && unselectedUploadedMatches.length === 0 && localMatches.length === 0) {
      return resolved(
        reference,
        'selected',
        selectedUploadedMatches.length === 1 ? 'Selected' : `${selectedUploadedMatches.length} uploaded files selected`,
        selectedUploadedMatches.map(file => file.id),
        []
      )
    }

    if (unselectedUploadedMatches.length > 0 || localMatches.length > 0) {
      const existingFileIds = unselectedUploadedMatches.map(file => file.id)
      const uploadFiles = localMatches.map(file => ({ contextPath: file.contextPath, file: file.file }))
      const parts: string[] = []
      if (existingFileIds.length > 0) {
        parts.push(`${existingFileIds.length} uploaded`)
      }
      if (uploadFiles.length > 0) {
        parts.push(`${uploadFiles.length} local`)
      }
      return resolved(reference, 'uploadable', parts.join(', '), existingFileIds, uploadFiles)
    }

    return resolved(reference, 'missing', 'Missing from selected context and local files', [], [])
  })
}

const resolved = (
  reference: DockerfileContextReference,
  status: ResolvedContextReferenceStatus,
  message: string,
  existingFileIds: string[],
  uploadFiles: LocalBuildContextFile[]
): ResolvedContextReference => ({
  contextPath: reference.contextPath,
  existingFileIds,
  message,
  reference,
  status,
  uploadFiles
})

const contextFilesByPath = (files: ContainerImageBuildContextFile[]) => {
  const byPath = new Map<string, ContainerImageBuildContextFile[]>()
  files.forEach(file => {
    const normalized = normalizeBuildContextPath(file.contextPath)
    if (!normalized) {
      return
    }
    byPath.set(normalized, [...(byPath.get(normalized) ?? []), file])
  })
  return byPath
}

const localFilesByPath = (files: LocalBuildContextFile[]) => {
  const byPath = new Map<string, LocalBuildContextFile>()
  files.forEach(file => {
    const normalized = normalizeBuildContextPath(file.contextPath)
    if (!normalized || byPath.has(normalized)) {
      return
    }
    byPath.set(normalized, { contextPath: normalized, file: file.file })
  })
  return byPath
}

const matchingUploadedFiles = (
  reference: DockerfileContextReference,
  uploadedByPath: Map<string, ContainerImageBuildContextFile[]>
) => {
  if (!reference.contextPath) {
    return []
  }

  const exactMatches = uploadedByPath.get(reference.contextPath) ?? []
  if (exactMatches.length > 0 && !reference.directoryHint) {
    return exactMatches
  }

  const prefix = `${reference.contextPath}/`
  const directoryMatches = [...uploadedByPath.entries()]
    .filter(([path]) => path.startsWith(prefix))
    .flatMap(([, files]) => files)
  return [...exactMatches, ...directoryMatches]
}

const matchingLocalFiles = (
  reference: DockerfileContextReference,
  localByPath: Map<string, LocalBuildContextFile>,
  uploadedPaths: Set<string>
) => {
  if (!reference.contextPath) {
    return []
  }

  const exactMatch = localByPath.get(reference.contextPath)
  if (exactMatch && !uploadedPaths.has(reference.contextPath) && !reference.directoryHint) {
    return [exactMatch]
  }

  const prefix = `${reference.contextPath}/`
  return [...localByPath.entries()]
    .filter(([path]) => path.startsWith(prefix) && !uploadedPaths.has(path))
    .map(([, file]) => file)
}
