'use client'

import type { ReactNode } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
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
import { AppActionDialogSummary } from '@/features/applications/components/app-action-dialog-summary'

export type RuntimeConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  summaryIcon: ReactNode
  summaryTitle: string
  summaryDescription: string
  details?: string[]
  disabled: boolean
  isWorking: boolean
  buttonVariant?: 'secondary' | 'destructive'
  buttonLabel: string
  workingLabel: string
  onConfirm: () => void
}

export const RuntimeConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  description,
  summaryIcon,
  summaryTitle,
  summaryDescription,
  details,
  disabled,
  isWorking,
  buttonVariant = 'secondary',
  buttonLabel,
  workingLabel,
  onConfirm
}: RuntimeConfirmationDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <AppActionDialogSummary
        icon={summaryIcon}
        title={summaryTitle}
        description={summaryDescription}
        details={details}
        tone='warning'
      />
      <DialogFooter>
        <Button
          variant='secondary'
          disabled={isWorking}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant={buttonVariant}
          disabled={disabled}
          onClick={onConfirm}
        >
          <Visible when={isWorking}>
            <IconLoader2 className='size-4 animate-spin' />
          </Visible>
          {isWorking ? workingLabel : buttonLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
