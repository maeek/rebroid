'use client'

import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Visible } from '@/components/ui/visible'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

export const StartProfileDialog = () => {
  const {
    app,
    isRunningAction,
    open,
    profileMode,
    profileName,
    savedProfiles,
    onModeChange,
    onNameChange,
    onOpenChange,
    onStart
  } = useRuntimePowerActionContext()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
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
          onModeChange={onModeChange}
          onNameChange={onNameChange}
        />
        <DialogFooter>
          <Button
            variant='secondary'
            disabled={isRunningAction}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant='update'
            disabled={!app || isRunningAction}
            onClick={onStart}
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
  )
}
