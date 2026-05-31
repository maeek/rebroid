'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import type { OrchestratorHealth, ServiceHealth } from '@/server/orchestrator/diagnostics/types'

type HealthState = 'checking' | 'online' | 'degraded' | 'offline'
type DisplayServiceStatus = ServiceHealth['status'] | 'degraded'
type DisplayService = Omit<ServiceHealth, 'status'> & { status: DisplayServiceStatus }

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

const mergeDockerAndRuntimeService = (health: OrchestratorHealth | null, fallbackMessage: string): DisplayService => {
  const docker = health?.services.docker ?? checkingService(fallbackMessage)
  const runtime = health?.services.runtime ?? checkingService(fallbackMessage)

  if (!docker.ok) {
    return docker
  }

  if (!runtime.ok) {
    return {
      ok: false,
      status: 'degraded',
      message: runtime.message,
      details: runtime.details
    }
  }

  return {
    ...docker,
    message: 'Docker API is reachable and the container runtime is suitable for privileged app containers.'
  }
}

const getOrchestratorHealth = getOrchestratorHealthAction
const dotTone = (status: DisplayServiceStatus) => {
  if (status === 'healthy') {
    return 'bg-green-400'
  }

  if (status === 'unhealthy' || status === 'degraded') {
    return 'bg-yellow-400'
  }

  return 'bg-destructive'
}

const badgeTone = (status: DisplayServiceStatus) => {
  if (status === 'healthy') {
    return 'border-green-400/30 bg-green-400/10 text-green-400'
  }

  if (status === 'unhealthy' || status === 'degraded') {
    return 'border-yellow-400/35 bg-yellow-400/10 text-yellow-300'
  }

  return 'border-destructive/35 bg-destructive/15 text-destructive'
}

const serviceRows = (health: OrchestratorHealth | null, fallbackMessage: string) => [
  {
    name: 'Orchestrator',
    href: '/settings/orchestrator',
    service: health?.services.orchestrator ?? checkingService(fallbackMessage)
  },
  {
    name: 'Docker',
    href: '/settings/orchestrator/containers',
    service: mergeDockerAndRuntimeService(health, fallbackMessage)
  },
  {
    name: 'Casting',
    href: '/settings/casting',
    service: health?.services.display ?? checkingService(fallbackMessage)
  },
  {
    name: 'Network access',
    href: '/settings/firewall',
    service: health?.services.firewall ?? checkingService(fallbackMessage)
  }
]

export const OrchestratorStatus = () => {
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
      services: {
        orchestrator: offlineService(errorMessage),
        docker: offlineService('Cannot inspect Docker while orchestrator is offline.'),
        runtime: offlineService('Cannot inspect runtime suitability while orchestrator is offline.'),
        display: offlineService('Cannot inspect casting sidecar while orchestrator is offline.'),
        firewall: offlineService('Cannot inspect firewall agent while orchestrator is offline.')
      }
    })
  }, [])

  const check = useCallback(async () => {
    try {
      applyHealth(await getOrchestratorHealth())
    } catch (error) {
      applyOfflineHealth(error)
    }
  }, [applyHealth, applyOfflineHealth])

  useEffect(() => {
    let isActive = true

    const guardedCheck = async () => {
      if (!isActive) {
        return
      }
      await check()
    }

    void guardedCheck()
    const interval = window.setInterval(() => void guardedCheck(), 10000)
    return () => {
      isActive = false
      window.clearInterval(interval)
    }
  }, [check])

  const icon =
    state === 'checking' ? (
      <IconLoader2 className='size-4 animate-spin' />
    ) : state === 'online' ? (
      <IconCircleCheck className='size-4' />
    ) : (
      <IconAlertTriangle className='size-4' />
    )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'flex max-w-[18rem] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            {
              'border-border/70 bg-secondary/50 text-secondary-foreground': state === 'checking',
              'border-green-400/30 bg-green-400/10 text-green-400': state === 'online',
              'border-yellow-400/40 bg-yellow-400/10 text-yellow-400': state === 'degraded',
              'border-destructive/50 bg-destructive/15 text-destructive': state === 'offline'
            }
          )}
        >
          {icon}
          <span className='truncate'>{message}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        collisionPadding={16}
        sideOffset={8}
        className='w-80 border-border/70 bg-card/95 p-2 backdrop-blur-xl'
      >
        <div className='space-y-0'>
          {serviceRows(health, message).map(({ name, href, service }) => (
            <Link
              key={name}
              href={href}
              title={service.message}
              className='flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/55'
            >
              <span className={cn('size-2.5 shrink-0 rounded-full', dotTone(service.status))} />
              <div className='flex min-w-0 grow items-center justify-between gap-2'>
                <p className='truncate text-xs font-medium text-foreground'>{name}</p>
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-normal',
                    badgeTone(service.status)
                  )}
                >
                  {service.status}
                </span>
              </div>
              <IconChevronRight className='size-4 shrink-0 text-secondary-foreground' />
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
