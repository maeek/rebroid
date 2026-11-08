import type { ReactNode } from 'react'
import { IconShield, IconSparkles } from '@tabler/icons-react'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'
import type { OptionalServicesUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export type ServiceId = keyof OptionalServicesUiSettings
export const serviceMeta: Record<
  ServiceId,
  {
    title: string
    description: string
    icon: ReactNode
    endpointPlaceholder: string
    endpointDescription: string
    hasSettings: boolean
    featureKey: FeatureFlagKey
  }
> = {
  ocr: {
    featureKey: 'feature.ocr',
    title: 'OCR perception',
    description: 'Screenshot text recognition for AI perception.',
    icon: <IconSparkles className='size-5' />,
    endpointPlaceholder: 'http://ocr-sidecar:4300',
    endpointDescription: 'Base HTTP URL for the OCR sidecar.',
    hasSettings: true
  },
  firewall: {
    featureKey: 'feature.firewall',
    title: 'Firewall agent',
    description: 'Network access policy enforcement.',
    icon: <IconShield className='size-5' />,
    endpointPlaceholder: '/run/rebroid-firewall/agent.sock',
    endpointDescription: 'Unix socket path or HTTP(S) base URL for the firewall agent.',
    hasSettings: false
  }
}

export const serviceDetails = (services: OptionalServicesUiSettings, id: ServiceId) => {
  if (id === 'ocr') {
    const ocr = services.ocr
    return `${ocr.language} · quality-gated cascade · min ${ocr.minConfidence}`
  }

  return 'Network policy reconciliation'
}

export const updateService = <T extends ServiceId>(
  services: OptionalServicesUiSettings,
  id: T,
  patch: Partial<OptionalServicesUiSettings[T]>
): OptionalServicesUiSettings => ({
  ...services,
  [id]: {
    ...services[id],
    ...patch
  }
})

export const serviceIds = ['ocr', 'firewall'] satisfies ServiceId[]

export const isServiceId = (value: string | null | undefined): value is ServiceId => serviceIds.some(id => id === value)
