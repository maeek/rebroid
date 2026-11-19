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
import { focusRingClassName } from '@/components/ui/surface'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { cn } from '@/lib/utils'

export const ConfirmMutationDialog = ({
  cancelLabel = 'Cancel',
  children,
  confirmationText,
  confirmDisabled = false,
  confirmLabel,
  description,
  details,
  error,
  finalFocus,
  open,
  pending = false,
  pendingLabel,
  tone = 'danger',
  title,
  onConfirm,
  onClosed,
  onOpenChange
}: {
  cancelLabel?: string
  children?: ReactNode
  confirmationText?: string
  confirmDisabled?: boolean
  confirmLabel: string
  description: ReactNode
  details?: { label: string; content: string }
  error?: ReactNode
  finalFocus?: ComponentProps<typeof DialogContent>['finalFocus']
  open: boolean
  pending?: boolean
  pendingLabel?: string
  tone?: 'warning' | 'danger'
  title: ReactNode
  onConfirm: () => void
  onClosed?: () => void
  onOpenChange: (open: boolean) => void
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [enteredText, setEnteredText] = useState('')
  const content = useMemo(
    () => ({ title, description, details, children, error, confirmLabel, confirmationText, tone }),
    [title, description, details, children, error, confirmLabel, confirmationText, tone]
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
        if (!nextOpen) {
          setEnteredText('')
          onClosed?.()
        }
      }}
    >
      <DialogContent
        className='grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 shadow-floating sm:max-w-[30rem] sm:p-0'
        showCloseButton={false}
        initialFocus={displayed.confirmationText ? inputRef : cancelRef}
        finalFocus={finalFocus}
      >
        <div className='scrollbar-thin grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-5 pt-5 pb-4 sm:px-6 sm:pt-6'>
          <DialogHeader>
            <DialogTitle className='text-xl'>{displayed.title}</DialogTitle>
            <DialogDescription>{displayed.description}</DialogDescription>
          </DialogHeader>
          {displayed.details ? (
            <details className='text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]'>
              <summary
                className={cn(
                  focusRingClassName,
                  'w-fit max-w-full cursor-pointer rounded-xs py-1 touch-manipulation hover:text-foreground touch:min-h-[var(--touch-target-size)] touch:content-center'
                )}
              >
                {displayed.details.label}
              </summary>
              <p className='mt-1'>{displayed.details.content}</p>
            </details>
          ) : null}
          {displayed.children}
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
        <DialogFooter className='px-5 pt-1 pb-5 sm:px-6 sm:pb-6'>
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
