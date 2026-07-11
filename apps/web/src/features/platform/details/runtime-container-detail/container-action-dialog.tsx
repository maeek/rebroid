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
  useContainerDetailContext,
  useContainerDetailControllerContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  actionDialogCopy,
  getActionButtonLabel
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'

export const ContainerActionDialog = () => {
  const { details } = useContainerDetailContext()
  const { closeActionDialog, forceRemove, isActing, pendingAction, runAction, setForceRemove } =
    useContainerDetailControllerContext()
  const containerState = details.container.state
  const copy = pendingAction ? actionDialogCopy[pendingAction] : actionDialogCopy.remove

  return (
    <Dialog
      modal
      open={Boolean(pendingAction)}
      onOpenChange={open => {
        closeActionDialog(open)
        if (!open) {
          setForceRemove(containerState === 'removing')
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <Visible when={pendingAction === 'remove'}>
          <label
            htmlFor='force-container-removal'
            className='flex items-start gap-3 rounded-panel border border-surface-border/60 bg-surface-band/45 px-3 py-3'
          >
            <Checkbox
              id='force-container-removal'
              checked={forceRemove}
              onCheckedChange={checked => setForceRemove(checked === true)}
              disabled={isActing}
            />
            <div className='space-y-1 text-sm'>
              <div className='font-medium'>Force removal</div>
              <p className='text-foreground-muted'>
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
            onClick={() => void runAction()}
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
