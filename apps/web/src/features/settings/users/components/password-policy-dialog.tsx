'use client'

import { useState } from 'react'
import { IconKey, IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { saveWebSettingsAction } from '@/server/web-settings/actions/save-web-settings-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import {
  isPasswordMinimumLength,
  passwordMinimumLengthError,
  passwordMinimumLengthLimits
} from '@/shared/model/settings/password-minimum-length'

export const PasswordPolicyDialog = ({
  initialPasswordMinimumLength,
  disabled = false
}: {
  initialPasswordMinimumLength: number
  disabled?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(initialPasswordMinimumLength))
  const [savedPasswordMinimumLength, setSavedPasswordMinimumLength] = useState(initialPasswordMinimumLength)
  const [isSaving, setIsSaving] = useState(false)
  const hasValue = draft.trim() !== ''
  const passwordMinimumLength = Number(draft)
  const isValid = hasValue && isPasswordMinimumLength(passwordMinimumLength)
  const canSave = isValid && passwordMinimumLength !== savedPasswordMinimumLength

  const setDialogOpen = (nextOpen: boolean) => {
    if (isSaving) return
    if (nextOpen) setDraft(String(savedPasswordMinimumLength))
    setOpen(nextOpen)
  }

  const savePasswordPolicy = async () => {
    if (!canSave || isSaving) return
    setIsSaving(true)
    try {
      const saved = unwrapActionResult(await saveWebSettingsAction({ passwordMinimumLength }))
      setSavedPasswordMinimumLength(saved.passwordMinimumLength)
      setOpen(false)
      toast({ title: 'Password policy saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save password policy',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={setDialogOpen}
    >
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          size='sm'
          variant='secondary'
        >
          <IconKey className='size-4' />
          Password policy
        </Button>
      </DialogTrigger>
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-lg'
      >
        <DialogHeader>
          <DialogTitle>Password policy</DialogTitle>
          <DialogDescription>
            Configure the minimum length used for new credentials and password resets.
          </DialogDescription>
        </DialogHeader>
        <FormField
          controlId='password-policy-minimum-length'
          label='Minimum password length'
          description='Applies to new passwords and resets. Set to 0 to allow passwords as short as one character.'
          error={hasValue && !isValid ? passwordMinimumLengthError : undefined}
          layout='vertical'
        >
          <Input
            className='max-w-48'
            type='number'
            inputMode='numeric'
            value={draft}
            min={passwordMinimumLengthLimits.min}
            max={passwordMinimumLengthLimits.max}
            step={1}
            disabled={isSaving}
            onChange={event => setDraft(event.target.value)}
          />
        </FormField>
        <DialogFooter className='border-t border-surface-border/55 pt-4'>
          <Button
            type='button'
            variant='secondary'
            disabled={isSaving}
            onClick={() => setDialogOpen(false)}
          >
            Cancel
          </Button>
          <MutationButton
            type='button'
            pending={isSaving}
            animate
            pendingLabel='Saving…'
            disabled={!canSave}
            onClick={() => void savePasswordPolicy()}
          >
            <IconDeviceFloppy className='size-4' />
            Save policy
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
