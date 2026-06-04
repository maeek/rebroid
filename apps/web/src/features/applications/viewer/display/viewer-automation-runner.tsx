'use client'

import { useState } from 'react'
import { IconPlayerPlay, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { runAutomationAction } from '@/server/orchestrator/automations/actions'
import type { Automation } from '@/server/orchestrator/automations/types'

export function ViewerAutomationRunner({
  applicationId,
  automations
}: {
  applicationId: string
  automations: Automation[]
}) {
  const [automationId, setAutomationId] = useState(automations[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  if (automations.length === 0) {
    return null
  }

  const run = async () => {
    if (!automationId) return
    setBusy(true)
    setStatus(null)
    try {
      const result = await runAutomationAction(automationId, applicationId)
      setStatus(`Queued ${result.id.slice(0, 8)}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Run failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='absolute bottom-4 left-4 z-20 grid w-[22rem] max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-border/70 bg-background/88 p-3 shadow-xl backdrop-blur-md'>
      <div className='flex items-center gap-2 text-sm font-medium'>
        <IconRobot className='size-4 text-primary' />
        Automations
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
        <select
          className='h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm'
          value={automationId}
          onChange={event => setAutomationId(event.target.value)}
        >
          {automations.map(automation => (
            <option
              key={automation.id}
              value={automation.id}
            >
              {automation.name}
            </option>
          ))}
        </select>
        <Button
          size='sm'
          disabled={busy}
          onClick={() => void run()}
        >
          <IconPlayerPlay className='size-4' />
          Run
        </Button>
      </div>
      {status ? <p className='truncate text-xs text-secondary-foreground'>{status}</p> : null}
    </div>
  )
}
