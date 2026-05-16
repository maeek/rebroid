'use client'

import { useEffect, useState } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconLoader2 } from '@tabler/icons-react'
import { getOrchestratorHealthAction } from '@/lib/orchestrator/actions'
import { cn } from '@/lib/utils'

type HealthState = 'checking' | 'online' | 'offline'

export const OrchestratorStatus = () => {
  const [state, setState] = useState<HealthState>('checking')
  const [message, setMessage] = useState('Checking')

  useEffect(() => {
    let isActive = true

    const check = async () => {
      try {
        const health = await getOrchestratorHealthAction()
        if (!isActive) {
          return
        }
        setState(health.ok && health.docker ? 'online' : 'offline')
        setMessage(health.ok && health.docker ? 'Online' : 'Unhealthy')
      } catch (error) {
        if (!isActive) {
          return
        }
        setState('offline')
        setMessage(error instanceof Error ? error.message : 'Unavailable')
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), 10000)
    return () => {
      isActive = false
      window.clearInterval(interval)
    }
  }, [])

  const icon =
    state === 'checking' ? (
      <IconLoader2 className='size-4 animate-spin' />
    ) : state === 'online' ? (
      <IconCircleCheck className='size-4' />
    ) : (
      <IconAlertTriangle className='size-4' />
    )

  return (
    <div
      className={cn(
        'flex max-w-[18rem] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
        state === 'checking' && 'border-border/70 bg-secondary/50 text-secondary-foreground',
        state === 'online' && 'border-green-400/30 bg-green-400/10 text-green-400',
        state === 'offline' && 'border-destructive/50 bg-destructive/15 text-destructive'
      )}
      title={message}
    >
      {icon}
      <span className='truncate'>{state === 'offline' ? 'Offline' : message}</span>
    </div>
  )
}
