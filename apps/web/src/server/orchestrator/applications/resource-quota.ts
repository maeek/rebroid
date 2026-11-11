import 'server-only'
import { unlimitedQuota, type ResourceQuota } from '@/shared/permissions/permissions'
import { loadFeatureFlags } from '../features'

export const getEnforcedResourceQuota = async (configured: ResourceQuota): Promise<ResourceQuota> => {
  if (Object.values(configured).every(limit => limit === null)) return configured
  const manifest = await loadFeatureFlags()
  const quota = manifest?.features.find(feature => feature.key === 'feature.resource-quota')
  return quota?.enabled === false ? unlimitedQuota : configured
}
