'use client'

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
import {
  actionNeedsDanglingOnly,
  actionNeedsRetentionDays
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import {
  useScheduledTasksContext,
  useScheduledTasksControllerContext
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { ScheduleEditor } from '@/shared/ui/schedule/schedule-editor'
import type { ScheduledTaskActionType } from '@/server/orchestrator/scheduled-tasks/types'

export const ScheduledTaskFormDialog = () => {
  const { initialActions } = useScheduledTasksContext()
  const { actionByType, closeForm, form, isFormOpen, isSaving, setForm, submitForm, updateSchedule } =
    useScheduledTasksControllerContext()
  const isEditing = Boolean(form.id)
  const isEditingPredefined = form.kind === 'predefined'

  return (
    <Dialog
      open={isFormOpen}
      onOpenChange={closeForm}
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
            void submitForm()
          }}
        >
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <label className='text-sm font-medium text-foreground'>Task details</label>
            <label className='flex items-center gap-3 text-sm text-foreground'>
              <Switch
                checked={form.enabled ?? true}
                onCheckedChange={enabled => setForm(current => ({ ...current, enabled }))}
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
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className='grid gap-2'>
            <label className='text-sm font-medium text-foreground'>Action</label>
            <Select
              value={form.actionType}
              disabled={isEditingPredefined}
              onValueChange={value =>
                setForm(current => ({
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
            onScheduleChange={updateSchedule}
          />
          <Visible when={actionNeedsDanglingOnly(form.actionType)}>
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <Checkbox
                checked={form.payload?.danglingOnly ?? true}
                onCheckedChange={checked =>
                  setForm(current => ({
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
                    setForm(current => ({
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
              onClick={() => closeForm(false)}
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
