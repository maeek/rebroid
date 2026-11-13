import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'

const featureLabelsInDisplayOrder = {
  'feature.workflows': 'Workflows',
  'feature.ai': 'AI',
  'feature.ocr': 'OCR perception',
  'feature.display-virtual': 'Virtual displays',
  'feature.display-webrtc': 'WebRTC streaming',
  'feature.image-builder': 'Image builder',
  'feature.firewall': 'Firewall enforcement',
  'feature.resource-quota': 'Resource quota'
} satisfies Record<FeatureFlagKey, string>

const displayRanks = new Map(Object.keys(featureLabelsInDisplayOrder).map((key, index) => [key, index]))
const displayRank = (key: FeatureFlagKey) => displayRanks.get(key) ?? displayRanks.size

export const featureLabel = (key: FeatureFlagKey) => featureLabelsInDisplayOrder[key]

export const orderFeaturesForDisplay = (features: readonly FeatureFlagState[]) =>
  features.toSorted((left, right) => displayRank(left.key) - displayRank(right.key))

export const featureDestination = (feature: FeatureFlagState) => {
  if (!feature.supported) return null

  if (feature.key === 'feature.ocr' && feature.enabled) return { label: 'Connection settings', href: '/platform/ocr' }
  if (feature.key === 'feature.firewall' && feature.enabled)
    return { label: 'Open firewall', href: '/security/firewall' }
  if (feature.key === 'feature.display-virtual' || feature.key === 'feature.display-webrtc')
    return { label: 'View sessions', href: '/platform/casting' }
  if (feature.key === 'feature.ai' && feature.enabled) return { label: 'Manage AI providers', href: '/platform/ai' }
  if (feature.key === 'feature.workflows' && feature.enabled) return { label: 'Open workflows', href: '/automations' }
  if (feature.key === 'feature.resource-quota') return { label: 'Manage users', href: '/security/users' }
  if (feature.key === 'feature.image-builder' && feature.enabled)
    return { label: 'Open image builder', href: '/runtime/images/build' }
  return null
}
