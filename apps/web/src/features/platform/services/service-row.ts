import type { ReactNode } from 'react'
import type { ServiceId } from './service-definitions'
import type { StatusBadgeTone } from '@/components/ui/status-badge'

export type ServiceRow = {
  id: ServiceId | 'display' | 'orchestrator' | 'docker'
  title: string
  description: string
  icon: ReactNode
  endpoint: string | null
  timeoutMs: number | null
  settingsSummary: string
  state: {
    label: string
    tone: StatusBadgeTone
    description?: string
  }
  action:
    | {
        type: 'edit'
        serviceId: ServiceId
      }
    | {
        type: 'link'
        href: string
        label: string
      }
}
