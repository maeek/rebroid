import { cache } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorSettingsClient } from './settings/client'
import type { FeatureFlagKey, FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const getFeatureManifest = cache(() => orchestratorSettingsClient.getFeatures())

export const loadFeatureFlags = async (): Promise<FeatureFlagManifest | null> => {
  try {
    return await getFeatureManifest()
  } catch {
    return null
  }
}

export const requireFeature = async (key: FeatureFlagKey, response?: 'api') => {
  await connection()
  const manifest = await getFeatureManifest()
  if (!manifest?.features.some(feature => feature.key === key && feature.enabled && feature.supported)) {
    if (response === 'api') throw new PublicActionError('Feature unavailable.', { code: 'not_found', status: 404 })
    notFound()
  }
}
