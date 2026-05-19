'use client'

import { useEffect, useState } from 'react'
import { IconLoader2, IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { startApplicationAction, stopApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { useAppViewerActionRunner } from './use-app-viewer-action-runner'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

export const AppViewerPowerAction = ({
  app,
  canStart,
  canStop,
  canSwitchProfile
}: {
  app?: AppDefinition
  canStart: boolean
  canStop: boolean
  canSwitchProfile: boolean
}) => {
  const { isRunningAction, runAction } = useAppViewerActionRunner()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(app?.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(app?.profileName ?? 'default')
  const isBusy = app?.status === 'provisioning' || app?.status === 'removing'

  useEffect(() => {
    if (!app || dialogOpen) {
      return
    }

    setProfileMode(app.profileMode ?? 'persistent')
    setProfileName(app.profileName ?? 'default')
  }, [app, dialogOpen])

  if (app?.running) {
    return (
      <Button
        variant='destructive'
        disabled={!canStop || isBusy || isRunningAction}
        onClick={() => void runAction(() => stopApplicationAction(app.id), 'Could not stop app')}
      >
        <Visible when={isRunningAction}>
          <IconLoader2 className='size-4 animate-spin' />
        </Visible>
        <Visible when={!isRunningAction}>
          <IconPlayerStopFilled className='size-4' />
        </Visible>
        Stop
      </Button>
    )
  }

  return (
    <>
      <Button
        variant='update'
        disabled={!app || !canStart || isBusy || isRunningAction}
        onClick={() => {
          if (!app) {
            return
          }

          if (canSwitchProfile) {
            setDialogOpen(true)
            return
          }

          void runAction(() => startApplicationAction(app.id), 'Could not start app')
        }}
      >
        <Visible when={isRunningAction}>
          <IconLoader2 className='size-4 animate-spin' />
        </Visible>
        <Visible when={!isRunningAction}>
          <IconPlayerPlayFilled className='size-4' />
        </Visible>
        Start
      </Button>
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Start app</DialogTitle>
            <DialogDescription>
              Choose the runtime profile for this session before the container starts.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label>Profile storage</Label>
              <Select
                value={profileMode}
                onValueChange={value => setProfileMode(value === 'temporary' ? 'temporary' : 'persistent')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='persistent'>Persistent volume</SelectItem>
                  <SelectItem value='temporary'>Temporary data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <Label>Profile name</Label>
              <Input
                value={profileName}
                disabled={profileMode === 'temporary'}
                placeholder='default'
                onChange={event => setProfileName(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='secondary'
              disabled={isRunningAction}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant='update'
              disabled={!app || isRunningAction}
              onClick={() => {
                if (!app) {
                  return
                }

                void runAction(
                  () =>
                    startApplicationAction(app.id, {
                      profileMode,
                      profileName: profileMode === 'temporary' ? 'temporary' : profileName.trim() || 'default'
                    }),
                  'Could not start app'
                ).then(success => {
                  if (success) {
                    setDialogOpen(false)
                  }
                })
              }}
            >
              <Visible when={isRunningAction}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              <Visible when={!isRunningAction}>
                <IconPlayerPlayFilled className='size-4' />
              </Visible>
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
