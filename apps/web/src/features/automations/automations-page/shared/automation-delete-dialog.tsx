'use client'

import { IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
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

export function AutomationDeleteDialog({
  open,
  title,
  description,
  busy,
  confirmLabel = 'Delete',
  onOpenChange,
  onConfirm
}: {
  open: boolean
  title: string
  description: string
  busy: boolean
  confirmLabel?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant='secondary'
              disabled={busy}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant='danger'
            disabled={busy}
            onClick={onConfirm}
          >
            <Visible when={busy}>
              <IconLoader2 className='size-4 animate-spin' />
            </Visible>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
