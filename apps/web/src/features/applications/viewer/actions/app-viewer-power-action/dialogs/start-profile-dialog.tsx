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
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'
import { ApplicationProfileSelect } from '@/shared/ui/application-profile/application-profile-select'

export const StartProfileDialog = () => {
  const {
    app,
    canDeleteProfiles,
    isRunningAction,
    open,
    profileMode,
    profileName,
    savedProfiles,
    onModeChange,
    onNameChange,
    onOpenChange,
    onProfileDelete,
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
        <ApplicationProfileSelect
          mode={profileMode}
          name={profileName}
          savedProfiles={savedProfiles}
          disabled={isRunningAction}
          canDeleteProfiles={canDeleteProfiles}
          onDeleteProfile={onProfileDelete}
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
