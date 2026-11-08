import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'

const featureLabels = {
  'feature.ocr': 'OCR perception',
  'feature.firewall': 'Firewall enforcement',
  'feature.image-builder': 'Image builder',
  'feature.display-virtual': 'Virtual displays'
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
  if (feature.key === 'feature.display-virtual')
    return { label: 'View sessions', href: '/platform/services/display-sessions' }
  if (feature.enabled && feature.supported) return { label: 'Open image builder', href: '/runtime/images/build' }
  return null
}
