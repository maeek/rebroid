'use client'

import { IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
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
import { MutationButton } from '@/components/ui/mutation-button'
import { NumericUnitInput } from '@/components/ui/numeric-unit-input'
import { Section } from '@/components/ui/section'
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
      <DialogContent
        data-editor-dialog=''
        className='sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit scheduled task' : 'New scheduled task'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the schedule and availability for this maintenance job.'
              : 'Create a recurring maintenance job with a simple schedule.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className='grid gap-6'
          onSubmit={event => {
            event.preventDefault()
            void submitForm()
          }}
        >
          <Section
            title='Task details'
            surface='plain'
            headingSpacing='compact'
          >
            <div className='grid gap-4'>
              <FormField
                label='Name'
                layout='vertical'
                controlId='scheduled-task-name'
                required
              >
                <Input
                  value={form.name}
                  disabled={isEditingPredefined}
                  placeholder='Nightly cleanup'
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                />
              </FormField>
              <FormField
                label='Action'
                layout='vertical'
                controlId='scheduled-task-action'
                description={actionByType.get(form.actionType)?.description}
              >
                <Select
                  value={form.actionType}
                  disabled={isEditingPredefined}
                  onValueChange={value => setForm(current => ({ ...current, actionType: value, payload: {} }))}
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
              </FormField>
              <FormField
                layout='vertical'
                label='Enabled'
                controlId='scheduled-task-enabled'
                description='Run automatically on this schedule.'
              >
                <Switch
                  checked={form.enabled ?? true}
                  onCheckedChange={enabled => setForm(current => ({ ...current, enabled }))}
                />
              </FormField>
            </div>
          </Section>
          <ScheduleEditor
            schedule={form.schedule}
            onScheduleChange={updateSchedule}
          />
          <Visible when={actionNeedsDanglingOnly(form.actionType)}>
            <FormField
              layout='vertical'
              label='Dangling images only'
              controlId='scheduled-task-dangling-only'
            >
              <Switch
                checked={form.payload?.danglingOnly ?? true}
                onCheckedChange={checked =>
                  setForm(current => ({
                    ...current,
                    payload: { ...current.payload, danglingOnly: checked }
                  }))
                }
              />
            </FormField>
          </Visible>
          <Visible when={actionNeedsRetentionDays(form.actionType)}>
            <FormField
              label={
                form.actionType === 'clean_workflow_history'
                  ? 'Keep finished workflow runs for'
                  : 'Remove logs older than'
              }
              description={
                form.actionType === 'clean_workflow_history'
                  ? 'The task removes expired runs, step results, and events on its schedule.'
                  : undefined
              }
              layout='vertical'
              controlId='scheduled-task-retention-days'
            >
              <NumericUnitInput
                unit='days'
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
            </FormField>
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
            <MutationButton
              type='submit'
              disabled={form.name.trim().length < 2}
              pending={isSaving}
              pendingLabel={isEditing ? 'Saving changes…' : 'Creating task…'}
            >
              {isEditing ? <IconDeviceFloppy className='size-4' /> : <IconPlus className='size-4' />}
              {isEditing ? 'Save changes' : 'Create task'}
            </MutationButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
