'use client'

import { useEffect, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type { AutomationStepForm } from '../../editor/builder-utils'

export function AutomationStepSettingsDialog({
  open,
  step,
  onOpenChange,
  onApply
}: {
  open: boolean
  step: AutomationStepForm | null
  onOpenChange: (open: boolean) => void
  onApply: (stepId: string) => void
}) {
  const [stepId, setStepId] = useState('')

  useEffect(() => {
    if (open) setStepId(step?.id ?? '')
  }, [open, step?.id])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent data-editor-dialog=''>
        <DialogHeader>
          <DialogTitle>Step settings</DialogTitle>
          <DialogDescription className='sr-only'>Edit selected step settings.</DialogDescription>
        </DialogHeader>
        <FormField
          controlId='automation-selected-step-id'
          label='Step ID'
          description='Used when referencing this step from other steps.'
          layout='vertical'
        >
          <Input
            id='automation-selected-step-id'
            value={stepId}
            placeholder='Generated when empty'
            onChange={event => setStepId(event.target.value)}
          />
        </FormField>
        <DialogFooter>
          <Button
            variant='secondary'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(stepId)
              onOpenChange(false)
            }}
          >
            <IconCheck className='size-4' />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
