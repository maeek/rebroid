'use client'

import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { useDialogPayload } from '@/hooks/use-dialog-payload'

export const ConfirmMutationDialog = ({
  cancelLabel = 'Cancel',
  confirmationText,
  confirmDisabled = false,
  confirmLabel,
  consequence,
  description,
  error,
  finalFocus,
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
  confirmationText?: string
  confirmDisabled?: boolean
  confirmLabel: string
  consequence?: ReactNode
  description: ReactNode
  error?: ReactNode
  finalFocus?: ComponentProps<typeof DialogContent>['finalFocus']
  open: boolean
  pending?: boolean
  pendingLabel?: string
  summary?: ReactNode
  tone?: 'warning' | 'danger'
  title: ReactNode
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [enteredText, setEnteredText] = useState('')
  const content = useMemo(
    () => ({ title, description, consequence, summary, error, confirmLabel, confirmationText, tone }),
    [title, description, consequence, summary, error, confirmLabel, confirmationText, tone]
  )
  const { payload, onOpenChangeComplete } = useDialogPayload(open ? content : null)
  const displayed = payload ?? content
  const matches = !displayed.confirmationText || enteredText === displayed.confirmationText

  return (
    <Dialog
      modal
      disablePointerDismissal
      open={open}
      onOpenChange={(nextOpen, event) => {
        if (pending) {
          event.cancel()
          return
        }
        onOpenChange(nextOpen)
      }}
      onOpenChangeComplete={nextOpen => {
        onOpenChangeComplete(nextOpen)
        if (!nextOpen) setEnteredText('')
      }}
    >
      <DialogContent
        className='max-w-full grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 shadow-floating sm:max-w-[30rem]'
        showCloseButton={false}
        initialFocus={displayed.confirmationText ? inputRef : cancelRef}
        finalFocus={finalFocus}
      >
        <div className='scrollbar-thin grid min-h-0 gap-4 overflow-y-auto p-6 pb-4 max-sm:px-5'>
          <DialogHeader className='gap-3'>
            <DialogTitle className='text-xl leading-snug [overflow-wrap:anywhere]'>{displayed.title}</DialogTitle>
            <DialogDescription
              render={<div />}
              className='grid gap-2 text-sm leading-relaxed [overflow-wrap:anywhere]'
            >
              <div className='text-foreground'>{displayed.description}</div>
              {displayed.consequence ? <div>{displayed.consequence}</div> : null}
            </DialogDescription>
          </DialogHeader>
          {displayed.summary ? (
            <div className='grid gap-1 border-s-2 border-surface-border ps-3 text-sm leading-relaxed [overflow-wrap:anywhere]'>
              <div className='text-xs font-medium text-foreground-muted'>Affected resources</div>
              <div>{displayed.summary}</div>
            </div>
          ) : null}
          {displayed.confirmationText ? (
            <FormField
              layout='vertical'
              label='Confirmation text'
              description={
                <>
                  Enter <code className='font-medium text-foreground'>{displayed.confirmationText}</code> to confirm.
                </>
              }
            >
              <Input
                ref={inputRef}
                autoComplete='off'
                autoCapitalize='off'
                spellCheck={false}
                disabled={pending}
                value={enteredText}
                onChange={event => setEnteredText(event.target.value)}
              />
            </FormField>
          ) : null}
          {displayed.error ? <Notice tone='danger'>{displayed.error}</Notice> : null}
        </div>
        <DialogFooter className='flex-row flex-wrap items-center justify-end gap-2 px-6 pt-1 pb-6 max-sm:px-5 [&_button]:max-w-full [&_button]:whitespace-normal'>
          <DialogClose asChild>
            <Button
              ref={cancelRef}
              type='button'
              variant='ghost'
              disabled={pending}
            >
              {cancelLabel}
            </Button>
          </DialogClose>
          <MutationButton
            type='button'
            variant={displayed.tone === 'danger' ? 'danger' : 'primary'}
            disabled={!open || confirmDisabled || !matches}
            pending={pending}
            pendingLabel={pendingLabel}
            onClick={onConfirm}
          >
            {displayed.confirmLabel}
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
