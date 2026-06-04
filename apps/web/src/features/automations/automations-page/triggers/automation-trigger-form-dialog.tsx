'use client'

import { IconLoader2, IconPlus } from '@tabler/icons-react'
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
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import { ScheduleEditor } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-editor'
import { AutomationTagsInput } from '../shared/automation-tags-input'
import { appProfileMode, appProfileName, appSavedProfiles } from './automation-trigger-utils'
import type { TriggerFormState } from './automation-trigger-types'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation } from '@/server/orchestrator/automations/types'

export function AutomationTriggerFormDialog({
  applications,
  automations,
  form,
  saving,
  selectedApplication,
  onOpenChange,
  onSave,
  onUpdateForm,
  onUpdateTargetApplication
}: {
  applications: AndroidApplication[]
  automations: Automation[]
  form: TriggerFormState | null
  saving: boolean
  selectedApplication?: AndroidApplication
  onOpenChange: (open: boolean) => void
  onSave: () => void
  onUpdateForm: (updater: (current: TriggerFormState) => TriggerFormState) => void
  onUpdateTargetApplication: (targetApplicationId: string) => void
}) {
  return (
    <Dialog
      open={Boolean(form)}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{form?.id ? 'Edit trigger' : 'New trigger'}</DialogTitle>
          <DialogDescription>Schedule an automation against an app profile.</DialogDescription>
        </DialogHeader>
        {form ? (
          <form
            className='grid gap-5'
            onSubmit={event => {
              event.preventDefault()
              onSave()
            }}
          >
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <label className='text-sm font-medium text-foreground'>Trigger details</label>
              <label className='flex items-center gap-3 text-sm text-foreground'>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={enabled => onUpdateForm(current => ({ ...current, enabled }))}
                />
                Enabled
              </label>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Name</label>
              <Input
                value={form.name}
                onChange={event => onUpdateForm(current => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Automation</label>
              <Select
                value={form.automationId}
                onValueChange={automationId => onUpdateForm(current => ({ ...current, automationId }))}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {automations.map(automation => (
                    <SelectItem
                      key={automation.id}
                      value={automation.id}
                    >
                      {automation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium text-foreground'>Target app</label>
              <Select
                value={form.targetApplicationId}
                onValueChange={onUpdateTargetApplication}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {applications.map(application => (
                    <SelectItem
                      key={application.id}
                      value={application.id}
                    >
                      {application.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ApplicationProfilePicker
              mode={form.profileMode}
              name={form.profileName}
              savedProfiles={appSavedProfiles(selectedApplication)}
              selectedProfile={{
                mode: appProfileMode(selectedApplication),
                name: appProfileName(selectedApplication)
              }}
              onModeChange={profileMode => onUpdateForm(current => ({ ...current, profileMode }))}
              onNameChange={profileName => onUpdateForm(current => ({ ...current, profileName }))}
            />
            <AutomationTagsInput
              id='automation-trigger-tags'
              value={form.tags}
              onChange={tags => onUpdateForm(current => ({ ...current, tags }))}
            />
            <ScheduleEditor
              schedule={form.schedule}
              onScheduleChange={patch =>
                onUpdateForm(current => ({ ...current, schedule: { ...current.schedule, ...patch } }))
              }
            />
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <Checkbox
                checked={form.startPolicy === 'start-if-needed'}
                onCheckedChange={checked =>
                  onUpdateForm(current => ({
                    ...current,
                    startPolicy: checked === true ? 'start-if-needed' : 'require-running'
                  }))
                }
              />
              Start app before running if needed
            </label>
            <DialogFooter>
              <Button
                type='button'
                variant='secondary'
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={saving || form.name.trim().length < 2}
              >
                <Visible when={saving}>
                  <IconLoader2 className='size-4 animate-spin' />
                </Visible>
                <Visible when={!saving}>
                  <IconPlus className='size-4' />
                </Visible>
                {form.id ? 'Save changes' : 'Create trigger'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
