import { notFound } from 'next/navigation'
import 'server-only'
import { orchestratorSettingsClient } from './settings/client'
import type { FeatureFlagKey, FeatureFlagManifest } from '@/shared/contracts/feature-flags'

export const loadFeatureFlags = async (): Promise<FeatureFlagManifest | null> => {
  try {
    return await orchestratorSettingsClient.getFeatures()
  } catch {
    return null
  }
}

export const requireFeature = async (key: FeatureFlagKey) => {
  const manifest = await loadFeatureFlags()
  if (!manifest?.features.some(feature => feature.key === key && feature.enabled && feature.supported)) {
    notFound()
  }
}
