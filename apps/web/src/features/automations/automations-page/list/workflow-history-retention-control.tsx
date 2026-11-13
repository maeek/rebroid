'use client'

import { useState, useTransition } from 'react'
import { IconHistory } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { toast } from '@/hooks/use-toast'
import { saveWorkflowHistoryRetentionAction } from '@/server/orchestrator/scheduled-tasks/actions'
import { defaultWorkflowHistoryRetentionDays } from '@/shared/contracts/scheduled-task'
import type { ActionResult } from '@/shared/actions/action-result'
import type { WorkflowHistoryRetention } from '@/shared/contracts/scheduled-task'

export const WorkflowHistoryRetentionControl = ({ initial }: { initial: ActionResult<WorkflowHistoryRetention> }) => {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState('')
  const [saveError, setSaveError] = useState<string>()
  const [saving, startSaving] = useTransition()

  const save = () => {
    if (!initial.ok || saving) return
    setSaveError(undefined)
    startSaving(async () => {
      try {
        const result = await saveWorkflowHistoryRetentionAction(Number(days))
        if (!result.ok) {
          setSaveError(`${result.error.message} Request ID ${result.requestId}.`)
          return
        }
        setOpen(false)
        toast({ title: 'Workflow history retention updated', variant: 'success' })
      } catch {
        setSaveError('Could not save workflow history retention. Try again.')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (saving) return
        if (nextOpen) {
          if (initial.ok) setDays(String(initial.data.retentionDays))
          setSaveError(undefined)
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button variant='secondary'>
          <IconHistory className='size-4' />
          Run history retention
        </Button>
      </DialogTrigger>
      <DialogContent
        className='sm:max-w-md'
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>Workflow run history retention</DialogTitle>
          <DialogDescription>
            The built-in maintenance task removes older completed workflow runs across the platform on its schedule.
          </DialogDescription>
        </DialogHeader>
        {initial.ok ? (
          <form
            className='grid gap-6'
            onSubmit={event => {
              event.preventDefault()
              save()
            }}
          >
            <FormField
              label='Retention days'
              description={`Keep runs for 1–3,650 days. The default is ${defaultWorkflowHistoryRetentionDays} days.`}
              layout='vertical'
            >
              <NumericUnitInput
                unit='days'
                type='number'
                required
                min={1}
                max={3650}
                step={1}
                disabled={saving}
                value={days}
                onChange={event => setDays(event.target.value)}
              />
            </FormField>
            {initial.data.enabled ? null : <Notice>Automatic cleanup is paused in Maintenance tasks.</Notice>}
            {saveError ? <Notice tone='danger'>{saveError}</Notice> : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={saving}
                >
                  Cancel
                </Button>
              </DialogClose>
              <MutationButton
                type='submit'
                pending={saving}
                animate
                pendingLabel='Saving…'
              >
                Save retention
              </MutationButton>
            </DialogFooter>
          </form>
        ) : (
          <Notice tone='danger'>
            {initial.error.message} Request ID {initial.requestId}.
          </Notice>
        )}
      </DialogContent>
    </Dialog>
  )
}
