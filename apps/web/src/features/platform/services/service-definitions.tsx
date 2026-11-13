import type { ReactNode } from 'react'
import { IconShield, IconSparkles } from '@tabler/icons-react'
import { isOptionalServiceVisible } from '@/shared/model/diagnostics/service-health'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'
import type { OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export type ServiceId = keyof OptionalServicesUiSettings
export const serviceMeta: Record<
  ServiceId,
  {
    title: string
    description: string
    href: string
    icon: ReactNode
    endpointPlaceholder: string
    endpointDescription: string
    featureKey: FeatureFlagKey
  }
> = {
  ocr: {
    featureKey: 'feature.ocr',
    title: 'OCR perception',
    description: 'Screenshot text recognition for AI perception.',
    href: '/platform/ocr',
    icon: <IconSparkles className='size-5' />,
    endpointPlaceholder: 'http://ocr-sidecar:4300',
    endpointDescription: 'Base HTTP URL for the OCR sidecar.'
  },
  firewall: {
    featureKey: 'feature.firewall',
    title: 'Firewall agent',
    description: 'Network access policy enforcement.',
    href: '/security/firewall',
    icon: <IconShield className='size-5' />,
    endpointPlaceholder: '/run/rebroid-firewall/agent.sock',
    endpointDescription: 'Unix socket path or HTTP(S) base URL for the firewall agent.'
  }
}

export const serviceDetails = (services: OptionalServicesUiSettings, id: ServiceId) => {
  if (id === 'ocr') {
    const ocr = services.ocr
    return `${ocr.language} · quality-gated cascade · min ${ocr.minConfidence}`
  }

  return 'Network policy reconciliation'
}

const serviceIds = ['ocr', 'firewall'] satisfies ServiceId[]

export const visibleOptionalServiceIds = (
  getFeature: (key: FeatureFlagKey) => FeatureFlagState | undefined,
  health?: Partial<Record<ServiceId, ServiceHealth>>
) => serviceIds.filter(id => isOptionalServiceVisible(getFeature(serviceMeta[id].featureKey), health?.[id]))
