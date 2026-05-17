'use client'

import { useState } from 'react'
import { IconLoader2, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { startApplicationAction, stopApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppViewerRestartAction = ({ app }: { app?: AppDefinition }) => {
  const [open, setOpen] = useState(false)
  const { isRunningAction, runAction } = useAppViewerActionRunner()
  const isBusy = app?.status === 'provisioning' || app?.status === 'removing'

  const handleRestart = async () => {
    if (!app) {
      return
    }

    const didSucceed = await runAction(async () => {
      await stopApplicationAction(app.id)
      await startApplicationAction(app.id)
    }, 'Could not restart app')

    if (didSucceed) {
      setOpen(false)
    }
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant='secondary'
              disabled={!app || isBusy || isRunningAction}
            >
              <Visible
                when={isRunningAction}
                fallback={<IconRestore className='size-4' />}
              >
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>{' '}
              Restart
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Restart</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart {app?.name}?</DialogTitle>
          <DialogDescription>
            This action will kill the docker container and start it with configured settings. Do you wish to continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='destructive'
            disabled={!app || isBusy || isRunningAction}
            onClick={() => void handleRestart()}
          >
            <Visible when={isRunningAction}>
              <IconLoader2 className='size-4 animate-spin' />
            </Visible>
            Restart
          </Button>
          <DialogClose asChild>
            <Button variant='secondary'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
