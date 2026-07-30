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
import { MutationButton } from '@/components/ui/mutation-button'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { saveWebSettingsAction } from '@/server/web-settings/actions/save-web-settings-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

export const PasswordPolicyDialog = ({ initialPasswordMinimumLength }: { initialPasswordMinimumLength: number }) => {
  const [open, setOpen] = useState(false)
  const [passwordMinimumLength, setPasswordMinimumLength] = useState(initialPasswordMinimumLength)
  const [savedPasswordMinimumLength, setSavedPasswordMinimumLength] = useState(initialPasswordMinimumLength)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = passwordMinimumLength !== savedPasswordMinimumLength

  const setDialogOpen = (nextOpen: boolean) => {
    if (isSaving) return
    if (nextOpen) setPasswordMinimumLength(savedPasswordMinimumLength)
    setOpen(nextOpen)
  }

  const savePasswordPolicy = async () => {
    setIsSaving(true)
    try {
      const saved = unwrapActionResult(await saveWebSettingsAction({ passwordMinimumLength }))
      setPasswordMinimumLength(saved.passwordMinimumLength)
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
          size='sm'
          variant='secondary'
        >
          <IconKey className='size-4' />
          Password policy
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Password policy</DialogTitle>
          <DialogDescription>
            Configure the minimum length used for new credentials and password resets.
          </DialogDescription>
        </DialogHeader>
        <FormField
          controlId='password-policy-minimum-length'
          label='Minimum password length'
          description='Applies to new users, admin password resets, and profile password changes.'
          layout='vertical'
        >
          <NumberSliderField
            value={String(passwordMinimumLength)}
            min={8}
            max={128}
            inputSuffix='characters'
            showSlider={false}
            onValueChange={value => setPasswordMinimumLength(Number(value) || savedPasswordMinimumLength)}
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
            pendingLabel='Saving…'
            disabled={!isDirty}
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
