import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type ServiceHealth = OrchestratorApiSchemas['ServiceHealthDto']
export type OrchestratorHealth = OrchestratorApiSchemas['OrchestratorDiagnosticsDto']
export type DisplaySidecarSession = OrchestratorApiSchemas['DockerSidecarAdminSessionDto']
export type DockerMetricsSnapshot = OrchestratorApiSchemas['DockerMetricsSnapshotDto']
