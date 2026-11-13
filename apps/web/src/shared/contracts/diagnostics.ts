import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type ServiceHealth = OrchestratorApiSchemas['ServiceHealthDto']
export type OrchestratorHealth = OrchestratorApiSchemas['OrchestratorDiagnosticsDto']
export type DisplaySidecarSession = OrchestratorApiSchemas['DockerSidecarAdminSessionDto']
export type DockerMetricsSnapshot = OrchestratorApiSchemas['DockerMetricsSnapshotDto']

export type ServiceContainer = { id: string; name: string }
export type ServiceContainers = Partial<Record<'orchestrator' | 'display' | 'firewall' | 'ocr', ServiceContainer>>
