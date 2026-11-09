import type { StatusBadgeTone } from '@/components/ui/status-badge'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

export type EffectiveFeatureStatus = {
  kind: 'unavailable' | 'sync-failed' | 'restart-required' | 'waiting' | 'off' | 'active' | 'applying'
  label:
    'Unavailable' | 'Sync failed' | 'Restart required' | 'Waiting for display service' | 'Off' | 'Active' | 'Applying'
  tone: StatusBadgeTone
  description: string
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
      description: 'The configured state could not reach its owner.'
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
  if (!feature.enabled) {
    return { kind: 'off', label: 'Off', tone: 'neutral', description: 'The feature is configured off.' }
  }
  if (feature.effective) {
    return { kind: 'active', label: 'Active', tone: 'success', description: 'The configured state is active.' }
  }
  return {
    kind: 'applying',
    label: 'Applying',
    tone: 'info',
    description: 'The configured state is still being applied.'
  }
}
