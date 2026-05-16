'use client'

import { IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { startApplicationAction, stopApplicationAction } from '@/lib/orchestrator/actions'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '../../../(standard)/constants'

export const AppViewerPowerAction = ({ app }: { app?: AppDefinition }) => {
  const { isRunningAction, runAction } = useAppViewerActionRunner()
  const isBusy = app?.status === 'provisioning' || app?.status === 'removing'

  if (app?.running) {
    return (
      <Button
        variant='destructive'
        disabled={isBusy || isRunningAction}
        onClick={() => void runAction(() => stopApplicationAction(app.id), 'Could not stop app')}
      >
        {isRunningAction && <IconLoader2 className='size-4 animate-spin' />}
        Stop
      </Button>
    )
  }

  return (
    <Button
      variant='secondary'
      disabled={!app || isBusy || isRunningAction}
      onClick={() => app && void runAction(() => startApplicationAction(app.id), 'Could not start app')}
    >
      {isRunningAction && <IconLoader2 className='size-4 animate-spin' />}
      Start
    </Button>
  )
}
