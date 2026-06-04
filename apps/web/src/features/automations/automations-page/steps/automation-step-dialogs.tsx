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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AutomationStepForm } from '../editor/builder-utils'

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Step settings</DialogTitle>
          <DialogDescription className='sr-only'>Edit selected step settings.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='automation-selected-step-id'>Step id</Label>
          <Input
            id='automation-selected-step-id'
            value={stepId}
            placeholder='Generated when empty'
            onChange={event => setStepId(event.target.value)}
          />
        </div>
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
