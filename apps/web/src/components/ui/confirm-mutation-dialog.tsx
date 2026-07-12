'use client'

import type { ReactNode } from 'react'
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
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'

export const ConfirmMutationDialog = ({
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  confirmLabel,
  consequence,
  description,
  open,
  pending = false,
  pendingLabel,
  summary,
  tone = 'danger',
  title,
  onConfirm,
  onOpenChange
}: {
  cancelLabel?: string
  confirmDisabled?: boolean
  confirmLabel: string
  consequence?: ReactNode
  description: ReactNode
  open: boolean
  pending?: boolean
  pendingLabel?: string
  summary?: ReactNode
  tone?: 'warning' | 'danger'
  title: ReactNode
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => (
  <Dialog
    modal
    open={open}
    onOpenChange={nextOpen => {
      if (!pending) onOpenChange(nextOpen)
    }}
  >
    <DialogContent
      className='sm:max-w-md'
      showCloseButton={!pending}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {summary ? (
        <div className='rounded-control border border-surface-border/60 bg-surface-band/60 px-3 py-2 text-sm font-medium break-all'>
          {summary}
        </div>
      ) : null}
      {consequence ? (
        <Notice
          tone={tone}
          live='off'
        >
          {consequence}
        </Notice>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button
            type='button'
            variant='secondary'
            disabled={pending}
          >
            {cancelLabel}
          </Button>
        </DialogClose>
        <MutationButton
          type='button'
          variant={tone === 'danger' ? 'danger' : 'primary'}
          disabled={confirmDisabled}
          pending={pending}
          pendingLabel={pendingLabel}
          onClick={onConfirm}
        >
          {confirmLabel}
        </MutationButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
