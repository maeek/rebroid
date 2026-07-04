import type { ContainerImageBuildContextFile } from '@/server/orchestrator/platform/types'

export type DockerfileContextInstruction = 'ADD' | 'COPY'
export type DockerfileContextReferenceState = 'local' | 'ignored' | 'unsupported'
export type ResolvedContextReferenceStatus = 'selected' | 'uploadable' | 'missing' | 'unsupported' | 'ignored'

export interface DockerfileContextReference {
  id: string
  instruction: DockerfileContextInstruction
  lineNumber: number
  source: string
  state: DockerfileContextReferenceState
  contextPath: string | null
  directoryHint: boolean
  reason: string | null
}

export interface LocalBuildContextFile {
  contextPath: string
  file: File
}

export interface ResolvedContextReference {
  reference: DockerfileContextReference
  status: ResolvedContextReferenceStatus
  contextPath: string | null
  message: string
  existingFileIds: string[]
  uploadFiles: LocalBuildContextFile[]
}

export interface UploadResolvedContextResult {
  selectedIds: Set<string>
  uploadedFiles: ContainerImageBuildContextFile[]
}

export type UploadProgress = {
  completed: number
  total: number
}
