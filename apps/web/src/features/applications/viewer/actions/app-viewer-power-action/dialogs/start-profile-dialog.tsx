'use client'

import { IconPlayerPlayFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { MutationButton } from '@/components/ui/mutation-button'
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
      onOpenChange={next => {
        if (!isRunningAction) onOpenChange(next)
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-md'
        showCloseButton={!isRunningAction}
      >
        <DialogHeader>
          <DialogTitle>Start app</DialogTitle>
          <DialogDescription>Choose the saved profile for this session before the app starts.</DialogDescription>
        </DialogHeader>
        <ApplicationProfileSelect
          mode={profileMode}
          name={profileName}
          savedProfiles={savedProfiles}
          selectedProfile={app ? { mode: app.profileMode, name: app.profileName ?? 'default' } : undefined}
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
          <MutationButton
            disabled={!app}
            pending={isRunningAction}
            pendingLabel='Starting…'
            onClick={onStart}
          >
            <IconPlayerPlayFilled className='size-4' />
            Start app
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
