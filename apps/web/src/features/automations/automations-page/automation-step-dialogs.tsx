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
import { Textarea } from '@/components/ui/textarea'
import type { AutomationStepForm } from './builder-utils'

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

export function AutomationRawInputDialog({
  open,
  step,
  onOpenChange,
  onApply
}: {
  open: boolean
  step: AutomationStepForm | null
  onOpenChange: (open: boolean) => void
  onApply: (json: string) => void
}) {
  const [draft, setDraft] = useState('{}')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(step?.withJson ?? '{}')
      setError(null)
    }
  }, [open, step?.withJson])

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(draft || '{}')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input must be a JSON object.')
      }
      onApply(JSON.stringify(parsed, null, 2))
      onOpenChange(false)
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Invalid JSON.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Edit raw input</DialogTitle>
          <DialogDescription className='sr-only'>Edit selected step raw input JSON.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Textarea
            value={draft}
            className='min-h-80 font-mono text-xs'
            onChange={event => {
              setDraft(event.target.value)
              setError(null)
            }}
          />
          {error ? <p className='text-sm text-red-300'>{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant='secondary'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={apply}>
            <IconCheck className='size-4' />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
