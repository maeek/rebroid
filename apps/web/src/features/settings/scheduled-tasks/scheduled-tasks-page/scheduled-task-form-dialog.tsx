'use client'

import type { Dispatch, SetStateAction } from 'react'
import { IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import { ScheduleEditor } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-editor'
import {
  actionNeedsDanglingOnly,
  actionNeedsRetentionDays
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import type { FormState, ScheduledTasksActionMap } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTaskAction, ScheduledTaskActionType } from '@/server/orchestrator/scheduled-tasks/types'

export const ScheduledTaskFormDialog = ({
  actionByType,
  form,
  initialActions,
  isFormOpen,
  isSaving,
  onCloseForm,
  onFormChange,
  onSubmitForm,
  onUpdateSchedule
}: {
  actionByType: ScheduledTasksActionMap
  form: FormState
  initialActions: ScheduledTaskAction[]
  isFormOpen: boolean
  isSaving: boolean
  onCloseForm: (open: boolean) => void
  onFormChange: Dispatch<SetStateAction<FormState>>
  onSubmitForm: () => void
  onUpdateSchedule: (patch: Partial<FormState['schedule']>) => void
}) => {
  const isEditing = Boolean(form.id)
  const isEditingPredefined = form.kind === 'predefined'

  return (
    <Dialog
      open={isFormOpen}
      onOpenChange={onCloseForm}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit scheduled task' : 'New scheduled task'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the schedule and availability for this maintenance job.'
              : 'Create a recurring maintenance job with a simple schedule.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className='grid gap-5'
          onSubmit={event => {
            event.preventDefault()
            onSubmitForm()
          }}
        >
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <label className='text-sm font-medium text-foreground'>Task details</label>
            <label className='flex items-center gap-3 text-sm text-foreground'>
              <Switch
                checked={form.enabled ?? true}
                onCheckedChange={enabled => onFormChange(current => ({ ...current, enabled }))}
              />
              Enabled
            </label>
          </div>
          <div className='grid gap-2'>
            <label className='text-sm font-medium text-foreground'>Name</label>
            <Input
              value={form.name}
              disabled={isEditingPredefined}
              placeholder='Nightly cleanup'
              onChange={event => onFormChange(current => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className='grid gap-2'>
            <label className='text-sm font-medium text-foreground'>Action</label>
            <Select
              value={form.actionType}
              disabled={isEditingPredefined}
              onValueChange={value =>
                onFormChange(current => ({
                  ...current,
                  actionType: value as ScheduledTaskActionType,
                  payload: {}
                }))
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {initialActions.map(action => (
                  <SelectItem
                    key={action.type}
                    value={action.type}
                  >
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-sm text-secondary-foreground'>{actionByType.get(form.actionType)?.description}</p>
          </div>
          <ScheduleEditor
            schedule={form.schedule}
            onScheduleChange={onUpdateSchedule}
          />
          <Visible when={actionNeedsDanglingOnly(form.actionType)}>
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <Checkbox
                checked={form.payload?.danglingOnly ?? true}
                onCheckedChange={checked =>
                  onFormChange(current => ({
                    ...current,
                    payload: { ...current.payload, danglingOnly: checked === true }
                  }))
                }
              />
              Dangling images only
            </label>
          </Visible>
          <Visible when={actionNeedsRetentionDays(form.actionType)}>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Remove logs older than</label>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min={1}
                  max={3650}
                  value={form.payload?.retentionDays ?? 30}
                  onChange={event =>
                    onFormChange(current => ({
                      ...current,
                      payload: { ...current.payload, retentionDays: Number(event.target.value) }
                    }))
                  }
                />
                <span className='text-sm text-secondary-foreground'>days</span>
              </div>
            </div>
          </Visible>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving}
              onClick={() => onCloseForm(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isSaving || form.name.trim().length < 2}
            >
              {isEditing ? <IconDeviceFloppy className='size-4' /> : <IconPlus className='size-4' />}
              {isEditing ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
