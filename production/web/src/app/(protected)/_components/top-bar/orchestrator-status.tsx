'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { getOrchestratorHealthAction, repairScrcpySidecarAction } from '@/server/orchestrator/diagnostics/actions'
import type { OrchestratorHealth, ServiceHealth } from '@/server/orchestrator/diagnostics/types'

type HealthState = 'checking' | 'online' | 'degraded' | 'offline'

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

const getOrchestratorHealth = getOrchestratorHealthAction
const repairScrcpySidecar = repairScrcpySidecarAction

const dotTone = (status: ServiceHealth['status']) => {
  if (status === 'healthy') {
    return 'bg-green-400'
  }

  if (status === 'unhealthy') {
    return 'bg-yellow-400'
  }

  return 'bg-destructive'
}

const badgeTone = (status: ServiceHealth['status']) => {
  if (status === 'healthy') {
    return 'border-green-400/30 bg-green-400/10 text-green-400'
  }

  if (status === 'unhealthy') {
    return 'border-yellow-400/35 bg-yellow-400/10 text-yellow-300'
  }

  return 'border-destructive/35 bg-destructive/15 text-destructive'
}

const serviceRows = (health: OrchestratorHealth | null, fallbackMessage: string) => [
  {
    name: 'Orchestrator',
    service: health?.services.orchestrator ?? checkingService(fallbackMessage)
  },
  {
    name: 'Docker',
    service: health?.services.docker ?? checkingService(fallbackMessage)
  },
  {
    name: 'Scrcpy',
    service: health?.services.scrcpy ?? checkingService(fallbackMessage)
  }
]

export const OrchestratorStatus = () => {
  const [state, setState] = useState<HealthState>('checking')
  const [message, setMessage] = useState('Checking')
  const [health, setHealth] = useState<OrchestratorHealth | null>(null)
  const [isRepairingScrcpy, setIsRepairingScrcpy] = useState(false)

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
      scrcpy: false,
      services: {
        orchestrator: offlineService(errorMessage),
        docker: offlineService('Cannot inspect Docker while orchestrator is offline.'),
        scrcpy: offlineService('Cannot inspect ws-scrcpy while orchestrator is offline.')
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

  const canRepairScrcpy = Boolean(
    health?.services.orchestrator.ok && health.services.docker.ok && !health.services.scrcpy.ok
  )

  const repairScrcpy = async () => {
    setIsRepairingScrcpy(true)
    try {
      await repairScrcpySidecar()
      await check()
    } catch (error) {
      setHealth(current => {
        if (!current) {
          return current
        }

        return {
          ...current,
          scrcpy: false,
          ok: false,
          services: {
            ...current.services,
            scrcpy: {
              ...current.services.scrcpy,
              ok: false,
              status: 'offline',
              message: error instanceof Error ? error.message : 'Could not repair ws-scrcpy.'
            }
          }
        }
      })
      setState('degraded')
      setMessage('Degraded')
    } finally {
      setIsRepairingScrcpy(false)
    }
  }

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
        className='w-80 border-border/70 bg-card/95 p-2 backdrop-blur-xl'
      >
        <div className='space-y-0'>
          {serviceRows(health, message).map(({ name, service }) => (
            <div
              key={name}
              className='flex gap-3 rounded-md px-3 py-2 hover:bg-secondary/40 items-center'
            >
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', dotTone(service.status))} />
              <div className='min-w-0 grow shrink flex justify-between gap-2 items-center'>
                <div>
                  <p className='text-xs font-normal text-foreground'>{name}</p>
                  <p className='mt-0.5 line-clamp-2 text-[10px] text-secondary-foreground'>{service.message}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-normal',
                    badgeTone(service.status)
                  )}
                >
                  {service.status}
                </span>
              </div>
              <Visible when={name === 'Scrcpy' && canRepairScrcpy}>
                <button
                  type='button'
                  className='ml-auto inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-secondary/70 px-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70'
                  disabled={isRepairingScrcpy}
                  aria-label='Repair scrcpy sidecar'
                  onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    void repairScrcpy()
                  }}
                >
                  {isRepairingScrcpy ? <IconLoader2 className='size-3.5 animate-spin' /> : 'Fix'}
                </button>
              </Visible>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
