import type { StatusBadgeTone } from '@/components/ui/status-badge'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

export type EffectiveFeatureStatus = {
  kind: 'unavailable' | 'sync-failed' | 'restart-required' | 'waiting' | 'off' | 'active' | 'applying'
  label:
    'Unavailable' | 'Sync failed' | 'Restart required' | 'Waiting for display service' | 'Off' | 'Active' | 'Applying'
  tone: StatusBadgeTone
  description?: string
}

export const getEffectiveFeatureStatus = (feature: FeatureFlagState): EffectiveFeatureStatus => {
  if (!feature.supported) {
    return {
      kind: 'unavailable',
      label: 'Unavailable',
      tone: 'neutral',
      description: 'This deployment does not support the feature.'
    }
  }
  if (feature.syncStatus === 'failed') {
    return {
      kind: 'sync-failed',
      label: 'Sync failed',
      tone: 'danger',
      description:
        feature.owner === 'display'
          ? 'The display service did not acknowledge the saved setting.'
          : 'The owning service could not apply the saved setting.'
    }
  }
  if (feature.syncStatus === 'restart_required') {
    return {
      kind: 'restart-required',
      label: 'Restart required',
      tone: 'warning',
      description: 'A service restart is required to apply this state.'
    }
  }
  if (feature.owner === 'display' && feature.syncStatus === 'pending') {
    return {
      kind: 'waiting',
      label: 'Waiting for display service',
      tone: 'warning',
      description: 'The configuration is saved and is waiting for the display service to acknowledge it.'
    }
  }
  if (feature.syncStatus === 'applied' && feature.enabled === feature.effective) {
    if (feature.effective) return { kind: 'active', label: 'Active', tone: 'neutral' }
    return { kind: 'off', label: 'Off', tone: 'neutral' }
  }
  return {
    kind: 'applying',
    label: 'Applying',
    tone: 'info',
    description: 'The owning service is still applying the saved setting.'
  }
}
