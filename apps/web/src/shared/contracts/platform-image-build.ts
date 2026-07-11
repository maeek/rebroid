import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type ContainerImageBuildStatus = OrchestratorApiSchemas['ContainerImageBuildJob']['status']
export type ContainerImageBuildJob = OrchestratorApiSchemas['ContainerImageBuildJob']
export type GappsBuildPhase = ContainerImageBuildJob['phase']
export type GappsBuildPreset = OrchestratorApiSchemas['GappsBuildPresetDto']
export type GappsBuildPresetsResponse = OrchestratorApiSchemas['GappsBuildPresetsResponseDto']
export type StartGappsBuildInput = OrchestratorApiSchemas['StartGappsBuildDto']
export type SupportedGappsAndroidVersion = StartGappsBuildInput['androidVersion']
