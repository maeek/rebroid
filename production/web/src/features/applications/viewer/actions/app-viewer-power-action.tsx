'use client'

import { useEffect, useState } from 'react'
import {
  IconChevronDown,
  IconLoader2,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconRestore
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Visible } from '@/components/ui/visible'
import {
  loadSavedApplicationProfiles,
  rememberApplicationProfile
} from '@/features/applications/profiles/profile-history'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
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
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(app?.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(app?.profileName ?? 'default')
  const [savedProfiles, setSavedProfiles] = useState(() =>
    app
      ? loadSavedApplicationProfiles(
          app.id,
          { mode: app.profileMode ?? 'persistent', name: app.profileName ?? 'default' },
          app.savedProfiles
        )
      : []
  )
  const isBusy = app?.status === 'provisioning' || app?.status === 'removing'
  const canRestart = canStart && canStop
  const primaryVariant = app?.running ? 'secondary' : 'update'
  const primaryLabel = app?.running ? 'Stop' : 'Start'
  const primaryIcon = app?.running ? (
    <IconPlayerStopFilled className='size-4' />
  ) : (
    <IconPlayerPlayFilled className='size-4' />
  )
  const canRunPrimary = app?.running ? canStop : canStart

  useEffect(() => {
    if (!app || startDialogOpen) {
      return
    }

    setProfileMode(app.profileMode ?? 'persistent')
    setProfileName(app.profileName ?? 'default')
    setSavedProfiles(
      loadSavedApplicationProfiles(
        app.id,
        { mode: app.profileMode ?? 'persistent', name: app.profileName ?? 'default' },
        app.savedProfiles
      )
    )
  }, [app, startDialogOpen])

  const handleStart = async (options?: { profileMode?: ApplicationProfileMode; profileName?: string }) => {
    if (!app) {
      return false
    }

    const started = await runAction(() => startApplicationAction(app.id, options), 'Could not start app')
    if (started && options?.profileMode) {
      rememberApplicationProfile(app.id, {
        mode: options.profileMode,
        name: options.profileName?.trim() || 'default'
      })
      setSavedProfiles(
        loadSavedApplicationProfiles(app.id, {
          mode: options.profileMode,
          name: options.profileName?.trim() || 'default'
        })
      )
    }
    return started
  }

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    setProfileMode(mode)
    setProfileName(current => {
      if (mode === 'temporary') {
        return 'temporary'
      }

      return current === 'temporary' ? 'default' : current
    })
  }

  const handleStop = async () => {
    if (!app) {
      return false
    }

    return runAction(() => stopApplicationAction(app.id), 'Could not stop app')
  }

  const handlePrimaryAction = () => {
    if (!app) {
      return
    }

    if (app.running) {
      void handleStop()
      return
    }

    if (canSwitchProfile) {
      setStartDialogOpen(true)
      return
    }

    void handleStart()
  }

  const handleRestart = async () => {
    if (!app) {
      return
    }

    const didSucceed = await runAction(async () => {
      await stopApplicationAction(app.id)
      await startApplicationAction(app.id)
    }, 'Could not restart app')

    if (didSucceed) {
      setRestartDialogOpen(false)
    }
  }

  return (
    <>
      <div className='inline-flex items-center'>
        <Button
          variant={primaryVariant}
          disabled={!app || !canRunPrimary || isBusy || isRunningAction}
          className='rounded-r-none border-r-0'
          onClick={handlePrimaryAction}
        >
          <Visible
            when={isRunningAction}
            fallback={primaryIcon}
          >
            <IconLoader2 className='size-4 animate-spin' />
          </Visible>
          {primaryLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={primaryVariant}
              size='icon'
              disabled={!app || isBusy || isRunningAction || (!canStart && !canStop)}
              className='rounded-l-none px-2'
              aria-label='Runtime actions'
            >
              <IconChevronDown className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            className='min-w-48'
          >
            <DropdownMenuItem
              className='gap-2'
              disabled={!app || app.running || !canStart}
              onSelect={() => {
                if (!app) {
                  return
                }

                void handleStart()
              }}
            >
              <IconPlayerPlayFilled className='size-4' />
              Start with defaults
            </DropdownMenuItem>
            <DropdownMenuItem
              className='gap-2'
              disabled={!app || app.running || !canStart || !canSwitchProfile}
              onSelect={() => setStartDialogOpen(true)}
            >
              <IconPlayerPlayFilled className='size-4' />
              Start with profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className='gap-2'
              disabled={!app || !app.running || !canStop}
              onSelect={() => {
                void handleStop()
              }}
            >
              <IconPlayerStopFilled className='size-4' />
              Stop
            </DropdownMenuItem>
            <DropdownMenuItem
              className='gap-2'
              disabled={!app || !app.running || !canRestart}
              onSelect={() => setRestartDialogOpen(true)}
            >
              <IconRestore className='size-4' />
              Restart
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Start app</DialogTitle>
            <DialogDescription>Choose the saved profile for this session before the app starts.</DialogDescription>
          </DialogHeader>
          <ApplicationProfilePicker
            mode={profileMode}
            name={profileName}
            savedProfiles={savedProfiles}
            disabled={isRunningAction}
            onModeChange={handleProfileModeChange}
            onNameChange={setProfileName}
          />
          <DialogFooter>
            <Button
              variant='secondary'
              disabled={isRunningAction}
              onClick={() => setStartDialogOpen(false)}
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

                void handleStart({
                  profileMode,
                  profileName: profileMode === 'temporary' ? 'temporary' : profileName.trim() || 'default'
                }).then(success => {
                  if (success) {
                    setStartDialogOpen(false)
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
      <Dialog
        open={restartDialogOpen}
        onOpenChange={setRestartDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart {app?.name}?</DialogTitle>
            <DialogDescription>
              This will stop the current session and start a fresh one with the current settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='secondary'
              disabled={isRunningAction}
              onClick={() => setRestartDialogOpen(false)}
            >
              Cancel
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
