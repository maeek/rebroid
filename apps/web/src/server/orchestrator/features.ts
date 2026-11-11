import { notFound } from 'next/navigation'
import { connection } from 'next/server'
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
  await connection()
  const manifest = await orchestratorSettingsClient.getFeatures()
  if (!manifest?.features.some(feature => feature.key === key && feature.enabled && feature.supported)) {
    notFound()
  }
}
