'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Visible } from '@/components/ui/visible'
import {
  actionDialogCopy,
  getActionButtonLabel,
  type ContainerPendingAction
} from '@/features/orchestrator/details/orchestrator-container-detail/container-detail-utils'
import type { PlatformContainerDetails } from '@/server/orchestrator/platform/types'

export const ContainerActionDialog = ({
  containerState,
  forceRemove,
  isActing,
  pendingAction,
  onForceRemoveChange,
  onOpenChange,
  onRunAction
}: {
  containerState: PlatformContainerDetails['container']['state']
  forceRemove: boolean
  isActing: boolean
  pendingAction: ContainerPendingAction | null
  onForceRemoveChange: (forceRemove: boolean) => void
  onOpenChange: (open: boolean) => void
  onRunAction: () => void
}) => {
  const copy = pendingAction ? actionDialogCopy[pendingAction] : actionDialogCopy.remove

  return (
    <Dialog
      modal
      open={Boolean(pendingAction)}
      onOpenChange={open => {
        onOpenChange(open)
        if (!open) {
          onForceRemoveChange(containerState === 'removing')
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <Visible when={pendingAction === 'remove'}>
          <label className='flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-3'>
            <Checkbox
              checked={forceRemove}
              onCheckedChange={checked => onForceRemoveChange(checked === true)}
              disabled={isActing}
            />
            <div className='space-y-1 text-sm'>
              <div className='font-medium'>Force removal</div>
              <p className='text-secondary-foreground'>
                Sends Docker a forced delete request and retries briefly if removal is already in progress. Persistent
                volumes are not removed by this action.
              </p>
            </div>
          </label>
        </Visible>
        <DialogFooter>
          <Button
            variant={copy.buttonVariant}
            disabled={!pendingAction || isActing}
            onClick={onRunAction}
          >
            {pendingAction ? getActionButtonLabel(pendingAction, forceRemove) : 'Remove container'}
          </Button>
          <DialogClose asChild>
            <Button variant='secondary'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
