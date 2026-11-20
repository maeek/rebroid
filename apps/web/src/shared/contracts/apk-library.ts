import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type ApkLibraryEntry = OrchestratorApiSchemas['ApkLibraryEntryDto']
export type ApkLibraryMutation = OrchestratorApiSchemas['ApkLibraryMutationDto']
export type ApkLibraryMutationResult = OrchestratorApiSchemas['ApkLibraryMutationResultDto']
export type ApkBlockScope = NonNullable<ApkLibraryMutation['scope']>
export type ApkLibraryAction = ApkLibraryMutation['action']
export type ApkLibraryData = { entries: ApkLibraryEntry[]; canDelete: boolean; canBlock: boolean }
export type ApkChoice = Pick<
  OrchestratorApiSchemas['UploadedApkResponseDto'],
  'id' | 'displayName' | 'originalName' | 'packageName' | 'sizeBytes'
>
