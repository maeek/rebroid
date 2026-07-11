import type {
  SystemResourceCapacity as SystemResourceCapacityContract,
  SystemResources as SystemResourcesContract
} from '@/shared/contracts/system-resources'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type SystemResources = SystemResourcesContract
export type SystemResourceCapacity = SystemResourceCapacityContract
export type ServiceHealth = OrchestratorApiSchemas['ServiceHealthDto']
export type OrchestratorHealth = OrchestratorApiSchemas['OrchestratorDiagnosticsDto']
export type DisplaySidecarSession = OrchestratorApiSchemas['DockerSidecarAdminSessionDto']
export type DockerMetricsSnapshot = OrchestratorApiSchemas['DockerMetricsSnapshotDto']
