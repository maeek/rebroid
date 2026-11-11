import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'

const featureLabels = {
  'feature.ocr': 'OCR perception',
  'feature.firewall': 'Firewall enforcement',
  'feature.image-builder': 'Image builder',
  'feature.display-virtual': 'Virtual displays',
  'feature.ai': 'AI',
  'feature.workflows': 'Workflows',
  'feature.resource-quota': 'Resource quota',
  'feature.display-webrtc': 'WebRTC streaming'
} satisfies Record<FeatureFlagKey, string>

export const featureLabel = (key: FeatureFlagKey) => featureLabels[key]

export const featureDestination = (feature: FeatureFlagState) => {
  if (feature.key === 'feature.ocr')
    return {
      label: feature.enabled && feature.supported ? 'Connection settings' : 'View service',
      href: feature.enabled && feature.supported ? '/platform/services?service=ocr' : '/platform/services#ocr'
    }
  if (feature.key === 'feature.firewall')
    return {
      label: feature.enabled && feature.supported ? 'Connection settings' : 'View service',
      href: feature.enabled && feature.supported ? '/platform/services?service=firewall' : '/platform/services#firewall'
    }
  if (feature.key === 'feature.display-virtual' || feature.key === 'feature.display-webrtc')
    return { label: 'View sessions', href: '/platform/services/display-sessions' }
  if (feature.key === 'feature.ai' && feature.enabled) return { label: 'Manage AI providers', href: '/platform/ai' }
  if (feature.key === 'feature.workflows' && feature.enabled) return { label: 'Open workflows', href: '/automations' }
  if (feature.key === 'feature.resource-quota') return { label: 'Manage users', href: '/security/users' }
  if (feature.key === 'feature.image-builder' && feature.enabled && feature.supported)
    return { label: 'Open image builder', href: '/runtime/images/build' }
  return null
}
