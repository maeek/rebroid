import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type FeatureFlagState = OrchestratorApiSchemas['FeatureFlagStateDto']
export type FeatureFlagManifest = OrchestratorApiSchemas['FeatureFlagManifestDto']
export type UpdateFeatureFlags = OrchestratorApiSchemas['UpdateFeatureFlagsDto']
export type FeatureFlagKey = FeatureFlagState['key']
