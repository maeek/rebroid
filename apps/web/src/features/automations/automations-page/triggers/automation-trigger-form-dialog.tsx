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
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ApplicationProfileSelect } from '@/shared/ui/application-profile/application-profile-select'
import { ScheduleEditor } from '@/shared/ui/schedule/schedule-editor'
import { triggerApplicationOption, triggerWorkflowOption } from './automation-trigger-resource-options'
import { AutomationTriggerTagPicker } from './automation-trigger-tag-picker'
import { appProfileMode, appProfileName, appSavedProfiles } from './automation-trigger-utils'
import type { TriggerFormState } from './automation-trigger-types'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation } from '@/shared/contracts/automation'
import type { AutomationTag } from '@rebroid/automation-core/definition'

export function AutomationTriggerFormDialog({
  applications,
  automations,
  tagSuggestions,
  form,
  open,
  onOpenChangeComplete,
  saving,
  selectedApplication,
  onOpenChange,
  onSave,
  onUpdateForm,
  onUpdateWorkflow,
  onUpdateTargetApplication
}: {
  applications: AndroidApplication[]
  automations: Automation[]
  tagSuggestions: AutomationTag[]
  form: TriggerFormState | null
  open: boolean
  onOpenChangeComplete: (open: boolean) => void
  saving: boolean
  selectedApplication?: AndroidApplication
  onOpenChange: (open: boolean) => void
  onSave: () => void
  onUpdateForm: (updater: (current: TriggerFormState) => TriggerFormState) => void
  onUpdateWorkflow: (automationId: string) => void
  onUpdateTargetApplication: (targetApplicationId: string) => void
}) {
  const selectedWorkflow = automations.find(automation => automation.id === form?.automationId)
  const validTarget = Boolean(selectedApplication && selectedWorkflow)
  return (
    <Dialog
      open={open}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={nextOpen => {
        if (!saving) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='flex max-w-full flex-col overflow-hidden sm:max-w-2xl lg:max-w-5xl xl:min-h-[min(42rem,85dvh)] xl:max-w-[96rem]'
        showCloseButton={!saving}
      >
        <DialogHeader className='shrink-0 pr-6'>
          <DialogTitle>{form?.id ? 'Edit trigger' : 'New trigger'}</DialogTitle>
          <DialogDescription>Choose a workflow, target app, and schedule.</DialogDescription>
        </DialogHeader>
        {form ? (
          <form
            className='flex min-h-0 min-w-0 grow flex-col gap-4'
            onSubmit={event => {
              event.preventDefault()
              if (!saving) onSave()
            }}
          >
            <div className='scrollbar-thin -mx-2 min-h-0 grow overflow-y-auto px-2 py-1'>
              <fieldset
                disabled={saving}
                className='grid min-w-0 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3'
              >
                <fieldset className='grid min-w-0 gap-4'>
                  <legend className='mb-4 text-sm font-medium'>Trigger details</legend>
                  <FormField
                    label='Name'
                    description='A recognizable name for this scheduled run.'
                    layout='vertical'
                    required
                  >
                    <Input
                      value={form.name}
                      required
                      minLength={2}
                      maxLength={120}
                      onChange={event => onUpdateForm(current => ({ ...current, name: event.target.value }))}
                    />
                  </FormField>
                  <FormField
                    label='Description'
                    description='Explain what this trigger runs and when to use it.'
                    layout='vertical'
                  >
                    <Textarea
                      value={form.description}
                      rows={2}
                      maxLength={2000}
                      onChange={event => onUpdateForm(current => ({ ...current, description: event.target.value }))}
                    />
                  </FormField>
                  <AutomationTriggerTagPicker
                    suggestions={tagSuggestions}
                    value={form.tags}
                    disabled={saving}
                    onChange={tags => onUpdateForm(current => ({ ...current, tags }))}
                  />
                </fieldset>
                <fieldset className='grid min-w-0 gap-4'>
                  <legend className='mb-4 text-sm font-medium'>Workflow and target</legend>
                  <FormField
                    label='Workflow'
                    className='wrap-anywhere'
                    description={
                      selectedWorkflow
                        ? triggerWorkflowOption(selectedWorkflow).description
                        : 'Search by name, description, ID, or tag.'
                    }
                    error={
                      form.automationId && !selectedWorkflow
                        ? 'This workflow is no longer available. Choose another workflow.'
                        : undefined
                    }
                    layout='vertical'
                    required
                  >
                    <SingleSelectCombobox
                      options={automations.map(triggerWorkflowOption)}
                      value={form.automationId}
                      disabled={saving}
                      placeholder='Search workflows'
                      onValueChange={onUpdateWorkflow}
                    />
                  </FormField>
                  <FormField
                    label='Target app'
                    className='wrap-anywhere'
                    description={
                      selectedApplication
                        ? triggerApplicationOption(selectedApplication).description
                        : 'Search by name, package, image, or ID.'
                    }
                    error={
                      form.targetApplicationId && !selectedApplication
                        ? 'This app is no longer available. Choose another app.'
                        : undefined
                    }
                    layout='vertical'
                    required
                  >
                    <SingleSelectCombobox
                      options={applications.map(triggerApplicationOption)}
                      value={form.targetApplicationId}
                      disabled={saving}
                      placeholder='Search apps'
                      onValueChange={onUpdateTargetApplication}
                    />
                  </FormField>
                  <ApplicationProfileSelect
                    disabled={saving}
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
                  <FormField
                    label='Start app if needed'
                    description='Start a stopped app before running the workflow. Otherwise, the app must already be running.'
                    layout='horizontal'
                  >
                    <Switch
                      checked={form.startPolicy === 'start-if-needed'}
                      onCheckedChange={checked =>
                        onUpdateForm(current => ({
                          ...current,
                          startPolicy: checked ? 'start-if-needed' : 'require-running'
                        }))
                      }
                    />
                  </FormField>
                </fieldset>
                <div className='grid min-w-0 gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1'>
                  <ScheduleEditor
                    schedule={form.schedule}
                    onScheduleChange={patch =>
                      onUpdateForm(current => ({ ...current, schedule: { ...current.schedule, ...patch } }))
                    }
                  />
                  <FormField
                    label='Enabled'
                    description='Run automatically on this schedule.'
                    layout='horizontal'
                  >
                    <Switch
                      disabled={saving}
                      checked={form.enabled}
                      onCheckedChange={enabled => onUpdateForm(current => ({ ...current, enabled }))}
                    />
                  </FormField>
                </div>
              </fieldset>
            </div>
            <DialogFooter className='shrink-0'>
              <Button
                type='button'
                variant='secondary'
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <MutationButton
                type='submit'
                pending={saving}
                pendingLabel={form.id ? 'Saving…' : 'Creating…'}
                disabled={form.name.trim().length < 2 || !validTarget}
              >
                {form.id ? <IconDeviceFloppy className='size-4' /> : <IconPlus className='size-4' />}
                {form.id ? 'Save changes' : 'Create trigger'}
              </MutationButton>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
