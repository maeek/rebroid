import 'server-only'
import { unlimitedQuota, type ResourceQuota } from '@/shared/permissions/permissions'
import { loadFeatureFlags } from '../features'
import { enforceResourceQuotas, enforceSessionQuota } from './safety'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

export const getEnforcedResourceQuota = async (
  configured: ResourceQuota,
  manifest?: FeatureFlagManifest | null
): Promise<ResourceQuota> => {
  if (Object.values(configured).every(limit => limit === null)) return configured
  const features = manifest === undefined ? await loadFeatureFlags() : manifest
  const quota = features?.features.find(feature => feature.key === 'feature.resource-quota')
  return quota?.enabled === false ? unlimitedQuota : configured
}

export const enforceRuntimeQuotas = async (
  runtime: Pick<AndroidApplication['runtime'], 'resources' | 'inactivityTimeoutSeconds'>,
  configured: ResourceQuota
) => {
  const quotas = await getEnforcedResourceQuota(configured)
  enforceResourceQuotas(runtime.resources, quotas)
  enforceSessionQuota(runtime, quotas)
  return quotas
}
