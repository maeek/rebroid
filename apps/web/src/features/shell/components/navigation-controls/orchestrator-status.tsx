'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { cn } from '@/lib/utils'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'

type HealthState = 'checking' | 'online' | 'degraded' | 'offline'
type DisplayServiceStatus = ServiceHealth['status'] | 'degraded'

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

  if (status === 'disabled') {
    return 'bg-foreground-muted/50'
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

  if (status === 'disabled') {
    return 'border-surface-border/70 bg-surface-band/45 text-foreground-muted'
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
    href: '/platform/services?service=docker',
    service: health ? dockerRuntimeHealth(health) : checkingService(fallbackMessage)
  },
  {
    impact: 'Viewer sessions may be unavailable.',
    name: 'Casting',
    href: '/platform/services/display-sessions',
    service: health?.services.display ?? checkingService(fallbackMessage)
  },
  {
    impact: 'Network policy changes may not be applied.',
    name: 'Firewall',
    href: '/platform/services?service=firewall',
    service: health?.services.firewall ?? checkingService(fallbackMessage)
  },
  {
    impact: 'Automation text-recognition steps may be unavailable.',
    name: 'OCR',
    href: '/platform/services?service=ocr',
    service: health?.services.ocr ?? checkingService(fallbackMessage)
  }
]

export const OrchestratorStatus = ({ inRail = false, polling = true }: { inRail?: boolean; polling?: boolean }) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<HealthState>('checking')
  const [message, setMessage] = useState('Checking')
  const [health, setHealth] = useState<OrchestratorHealth | null>(null)

  const applyHealth = useCallback((nextHealth: OrchestratorHealth) => {
    setHealth(nextHealth)
    if (nextHealth.ok) {
      setState('online')
      setMessage('Online')
    } else {
      setState(nextHealth.services.orchestrator.ok ? 'degraded' : 'offline')
      setMessage(nextHealth.services.orchestrator.ok ? 'Degraded' : 'Offline')
    }
  }, [])

  const applyOfflineHealth = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unavailable'
    setState('offline')
    setMessage('Offline')
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
          variant={inRail ? 'bare' : 'ghost'}
          size='icon-sm'
          aria-label={`Service status: ${message}`}
          className={cn(
            'size-6 rounded-full',
            inRail && 'absolute -right-1 top-3 focus-visible:ring-inset touch:min-h-0 touch:min-w-0'
          )}
        >
          <span
            aria-hidden='true'
            className={cn('size-2 rounded-full', inRail && 'ring-2 ring-surface-navigation', {
              'bg-foreground-muted/60': state === 'checking',
              'bg-success': state === 'online',
              'bg-warning': state === 'degraded',
              'bg-danger': state === 'offline'
            })}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={inRail ? 'right' : 'bottom'}
        align='start'
        sideOffset={inRail ? 16 : 8}
        aria-label='Service status'
        collisionPadding={16}
        className='scrollbar-thin max-h-(--available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2'
      >
        <div className='space-y-0'>
          {serviceRows(health, message).map(({ name, href, service, impact }) => (
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
              {!service.ok && service.status !== 'disabled' ? (
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
