'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { semanticToneClassNames } from '@/components/ui/surface'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { cn } from '@/lib/utils'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { dockerRuntimeHealth, isOptionalServiceVisible } from '@/shared/model/diagnostics/service-health'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { navigationPopupPositions, type NavigationPopupPosition } from './popup-position'
import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'

type HealthState = 'checking' | 'online' | 'degraded' | 'offline'
type DisplayServiceStatus = ServiceHealth['status'] | 'degraded'

const healthPresentation = {
  checking: { label: 'Checking', tone: 'neutral', dot: 'bg-foreground-muted/60' },
  online: { label: 'Healthy', tone: 'success', dot: 'bg-success' },
  degraded: { label: 'Degraded', tone: 'warning', dot: 'bg-warning' },
  offline: { label: 'Offline', tone: 'danger', dot: 'bg-danger' }
} as const

const offlineService = (message: string): ServiceHealth => ({
  ok: false,
  status: 'offline',
  message
})

const checkingService = (message = 'Checking service health.'): ServiceHealth => ({
  ok: false,
  status: 'unhealthy',
  message
})

const getOrchestratorHealth = getOrchestratorHealthSummaryAction
const dotTone = (status: DisplayServiceStatus) => {
  if (status === 'healthy') {
    return 'bg-success'
  }

  if (status === 'unhealthy' || status === 'degraded') {
    return 'bg-warning'
  }

  return 'bg-danger'
}

const badgeTone = (status: DisplayServiceStatus) => {
  if (status === 'healthy') {
    return 'border-success/35 bg-success/10 text-success'
  }

  if (status === 'unhealthy' || status === 'degraded') {
    return 'border-warning/35 bg-warning/10 text-warning'
  }

  return 'border-danger/35 bg-danger/15 text-danger'
}

const serviceRows = (health: OrchestratorHealth | null, fallbackMessage: string) => [
  {
    impact: 'App lifecycle commands and platform operations depend on this service.',
    name: 'Orchestrator',
    href: '/platform/services?service=orchestrator',
    service: health?.services.orchestrator ?? checkingService(fallbackMessage)
  },
  {
    impact: 'App provisioning and runtime operations depend on Docker.',
    name: 'Docker',
    href: '/runtime/docker',
    service: health ? dockerRuntimeHealth(health) : checkingService(fallbackMessage)
  },
  {
    impact: 'Viewer sessions may be unavailable.',
    name: 'Casting',
    href: '/platform/casting',
    service: health?.services.display ?? checkingService(fallbackMessage)
  },
  {
    impact: 'Network policy changes may not be applied.',
    name: 'Firewall',
    optionalServiceId: 'firewall' as const,
    href: '/security/firewall',
    service: health?.services.firewall ?? checkingService(fallbackMessage)
  },
  {
    impact: 'Automation text-recognition steps may be unavailable.',
    name: 'OCR',
    optionalServiceId: 'ocr' as const,
    href: '/platform/services?service=ocr',
    service: health?.services.ocr ?? checkingService(fallbackMessage)
  }
]

export const OrchestratorStatus = ({
  compact = false,
  showSystemLabel = false,
  popupPosition = navigationPopupPositions.header,
  polling = true
}: {
  compact?: boolean
  showSystemLabel?: boolean
  popupPosition?: NavigationPopupPosition
  polling?: boolean
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<HealthState>('checking')
  const [health, setHealth] = useState<OrchestratorHealth | null>(null)
  const { getFeature } = useFeatureFlags()
  const { label, tone, dot } = healthPresentation[state]
  const visibleLabel = showSystemLabel && state !== 'checking' ? `System ${label.toLowerCase()}` : label

  const applyHealth = useCallback((nextHealth: OrchestratorHealth) => {
    setHealth(nextHealth)
    if (nextHealth.ok) {
      setState('online')
    } else {
      setState(nextHealth.services.orchestrator.ok ? 'degraded' : 'offline')
    }
  }, [])

  const applyOfflineHealth = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unavailable'
    setState('offline')
    setHealth({
      ok: false,
      docker: false,
      runtime: false,
      display: false,
      firewall: false,
      ocr: false,
      services: {
        orchestrator: offlineService(errorMessage),
        docker: offlineService('Cannot inspect Docker while orchestrator is offline.'),
        runtime: offlineService('Cannot inspect runtime suitability while orchestrator is offline.'),
        display: offlineService('Cannot inspect casting sidecar while orchestrator is offline.'),
        firewall: offlineService('Cannot inspect firewall agent while orchestrator is offline.'),
        ocr: offlineService('Cannot inspect OCR sidecar while orchestrator is offline.')
      }
    })
  }, [])

  const { data, error } = usePollingQuery<OrchestratorHealth>('orchestrator:health', () => getOrchestratorHealth(), {
    enabled: polling,
    intervalMs: 10_000
  })
  const rows = serviceRows(health, label).filter(({ service, optionalServiceId }) => {
    if (service.status === 'disabled') return false
    if (!optionalServiceId) return true

    return isOptionalServiceVisible(getFeature(`feature.${optionalServiceId}`), data?.services[optionalServiceId])
  })

  useEffect(() => {
    if (error) {
      applyOfflineHealth(error)
    } else if (data) {
      applyHealth(data)
    }
  }, [applyHealth, applyOfflineHealth, data, error])

  return (
    <Popover
      onOpenChange={(open, details) => {
        if (!open && details.reason === 'escape-key') {
          requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
        }
      }}
    >
      <PopoverTrigger
        asChild
        openOnHover
        closeDelay={150}
      >
        <Button
          ref={triggerRef}
          type='button'
          variant={compact ? 'ghost' : 'bare'}
          size='icon-md'
          aria-label={`Service status: ${label}`}
          className={cn('h-10 rounded-full', compact ? 'w-10' : 'w-auto')}
        >
          {compact ? (
            <span
              aria-hidden='true'
              className={cn('size-2 rounded-full', dot)}
            />
          ) : (
            <span
              data-tone={tone}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-surface-border/60 bg-surface-band px-1.5 py-0.5 text-xs text-foreground-muted lg:px-2',
                semanticToneClassNames[tone]
              )}
            >
              <span
                aria-hidden='true'
                className={cn('size-1.5 shrink-0 rounded-full', dot)}
              />
              {visibleLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        {...popupPosition}
        aria-label='Service status'
        collisionPadding={16}
        className='scrollbar-thin max-h-(--available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2'
      >
        <div className='space-y-0'>
          {rows.map(({ name, href, service, impact }) => (
            <Link
              key={name}
              href={href}
              title={service.message}
              className='flex flex-wrap items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-control-hover focus-visible:bg-control-hover'
            >
              <span className={cn('size-2.5 shrink-0 rounded-full', dotTone(service.status))} />
              <div className='flex min-w-0 grow items-center justify-between gap-2'>
                <p className='truncate text-xs font-medium text-foreground'>{name}</p>
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5 text-xs font-medium uppercase leading-none tracking-normal',
                    badgeTone(service.status)
                  )}
                >
                  {service.status}
                </span>
              </div>
              <IconChevronRight className='size-4 shrink-0 text-foreground-muted' />
              {!service.ok ? (
                <span className='w-full text-xs text-foreground-muted'>
                  {impact} {service.message}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
