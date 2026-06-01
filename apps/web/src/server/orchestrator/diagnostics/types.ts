import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type SystemResources = OrchestratorApiSchemas['SystemResourcesDto']
export type SystemResourceCapacity = OrchestratorApiSchemas['SystemResourceCapacityDto']
export type ServiceHealth = OrchestratorApiSchemas['ServiceHealthDto']
export type OrchestratorHealth = OrchestratorApiSchemas['OrchestratorDiagnosticsDto']
export type DisplaySidecarSession = OrchestratorApiSchemas['DockerSidecarAdminSessionDto']
