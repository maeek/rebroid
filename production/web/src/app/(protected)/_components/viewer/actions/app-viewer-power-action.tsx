'use client'

import { Button } from '@/components/ui/button'
import { startApplicationAction, stopApplicationAction } from '@/lib/orchestrator/actions'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '../../../(standard)/constants'

export const AppViewerPowerAction = ({ app }: { app?: AppDefinition }) => {
  const { runAction } = useAppViewerActionRunner()
  const isBusy = app?.status === 'provisioning' || app?.status === 'removing'

  if (app?.running) {
    return (
      <Button
        variant='destructive'
        disabled={isBusy}
        onClick={() => void runAction(() => stopApplicationAction(app.id), 'Could not stop app')}
      >
        Stop
      </Button>
    )
  }

  return (
    <Button
      variant='secondary'
      disabled={!app || isBusy}
      onClick={() => app && void runAction(() => startApplicationAction(app.id), 'Could not start app')}
    >
      Start
    </Button>
  )
}
