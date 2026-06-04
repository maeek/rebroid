'use client'

import { useMemo, useState } from 'react'
import { IconEdit, IconLoader2, IconPlayerPlayFilled, IconPlus, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import { ScheduleEditor } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-editor'
import {
  cronToSchedule,
  dateLabel,
  defaultSchedule,
  scheduleLabel,
  scheduleToCron
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationTriggerAction,
  deleteAutomationTriggerAction,
  runAutomationTriggerAction,
  updateAutomationTriggerAction
} from '@/server/orchestrator/automations/actions'
import { AutomationEmptySplash } from './automation-empty-splash'
import type { AutomationTriggersPageProps } from './types'
import type { ScheduleDraft } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { AndroidApplication, ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationLastStatus,
  AutomationStartPolicy,
  AutomationTrigger
} from '@/server/orchestrator/automations/types'

type TriggerFormState = {
  id?: string
  name: string
  automationId: string
  targetApplicationId: string
  profileMode: ApplicationProfileMode
  profileName: string
  enabled: boolean
  schedule: ScheduleDraft
  startPolicy: AutomationStartPolicy
}

const statusVariant = (status: AutomationLastStatus) =>
  status === 'success' ? 'status' : status === 'failed' ? 'destructive' : 'secondary'

const statusLabel = (status: AutomationLastStatus) => {
  if (status === 'never_run') return 'Never run'
  if (status === 'success') return 'Success'
  if (status === 'running') return 'Running'
  return 'Failed'
}

const appProfileMode = (app: AndroidApplication | null | undefined): ApplicationProfileMode =>
  app?.storage.profileMode ?? 'persistent'

const appProfileName = (app: AndroidApplication | null | undefined) => app?.storage.profileName ?? 'default'

const appSavedProfiles = (app: AndroidApplication | null | undefined) => app?.storage.savedProfiles ?? []

const getScheduleCron = (trigger: AutomationTrigger) => {
  const cronExpression = trigger.triggerConfig.cronExpression
  return typeof cronExpression === 'string' ? cronExpression : scheduleToCron(defaultSchedule)
}

const getStartPolicy = (trigger: AutomationTrigger): AutomationStartPolicy => {
  const startPolicy = trigger.triggerConfig.startPolicy
  return startPolicy === 'require-running' || startPolicy === 'start-if-needed' ? startPolicy : 'start-if-needed'
}

const defaultTriggerName = (automation: Automation | undefined, app: AndroidApplication | undefined) => {
  if (automation && app) return `${automation.name} on ${app.name}`
  return 'New automation trigger'
}

export function AutomationTriggersPage({
  initialApplications,
  initialAutomations,
  initialTriggers
}: AutomationTriggersPageProps) {
  const [triggers, setTriggers] = useState(initialTriggers)
  const [form, setForm] = useState<TriggerFormState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const automationById = useMemo(
    () => new Map(initialAutomations.map(automation => [automation.id, automation])),
    [initialAutomations]
  )
  const applicationById = useMemo(
    () => new Map(initialApplications.map(application => [application.id, application])),
    [initialApplications]
  )
  const selectedApplication = form ? applicationById.get(form.targetApplicationId) : undefined
  const canCreate = initialAutomations.length > 0 && initialApplications.length > 0

  const openCreate = () => {
    const automation = initialAutomations[0]
    const app = initialApplications[0]
    if (!automation || !app) return

    setForm({
      name: defaultTriggerName(automation, app),
      automationId: automation.id,
      targetApplicationId: app.id,
      profileMode: appProfileMode(app),
      profileName: appProfileName(app),
      enabled: true,
      schedule: defaultSchedule,
      startPolicy: 'start-if-needed'
    })
  }

  const openEdit = (trigger: AutomationTrigger) => {
    const app = applicationById.get(trigger.targetApplicationId)
    setForm({
      id: trigger.id,
      name: trigger.name,
      automationId: trigger.automationId,
      targetApplicationId: trigger.targetApplicationId,
      profileMode: (trigger.profileMode as ApplicationProfileMode | null) ?? appProfileMode(app),
      profileName: trigger.profileName ?? appProfileName(app),
      enabled: trigger.enabled,
      schedule: cronToSchedule(getScheduleCron(trigger)),
      startPolicy: getStartPolicy(trigger)
    })
  }

  const updateTargetApplication = (targetApplicationId: string) => {
    const app = applicationById.get(targetApplicationId)
    setForm(current =>
      current
        ? {
            ...current,
            targetApplicationId,
            profileMode: appProfileMode(app),
            profileName: appProfileName(app)
          }
        : current
    )
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        automationId: form.automationId,
        targetApplicationId: form.targetApplicationId,
        profileMode: form.profileMode,
        profileName: form.profileName.trim() || 'default',
        enabled: form.enabled,
        triggerType: 'schedule' as const,
        triggerConfig: {
          cronExpression: scheduleToCron(form.schedule),
          startPolicy: form.startPolicy
        }
      }
      const saved = form.id
        ? await updateAutomationTriggerAction(form.id, payload)
        : await createAutomationTriggerAction(payload)
      setTriggers(current => {
        const existing = current.some(trigger => trigger.id === saved.id)
        return existing ? current.map(trigger => (trigger.id === saved.id ? saved : trigger)) : [saved, ...current]
      })
      setForm(null)
      toast({ title: form.id ? 'Trigger updated' : 'Trigger created' })
    } catch (error) {
      toast({
        title: 'Could not save trigger',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (trigger: AutomationTrigger, enabled: boolean) => {
    setBusyId(trigger.id)
    try {
      const updated = await updateAutomationTriggerAction(trigger.id, { enabled })
      setTriggers(current => current.map(item => (item.id === updated.id ? updated : item)))
    } catch (error) {
      toast({
        title: 'Could not update trigger',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const runNow = async (trigger: AutomationTrigger) => {
    setBusyId(trigger.id)
    try {
      const run = await runAutomationTriggerAction(trigger.id)
      toast({ title: 'Automation queued', description: `Run ${run.id.slice(0, 8)} started.` })
    } catch (error) {
      toast({
        title: 'Could not run trigger',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (trigger: AutomationTrigger) => {
    if (!window.confirm(`Delete trigger "${trigger.name}"?`)) return

    setBusyId(trigger.id)
    try {
      await deleteAutomationTriggerAction(trigger.id)
      setTriggers(current => current.filter(item => item.id !== trigger.id))
      toast({ title: 'Trigger deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete trigger',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='grid gap-3'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Automations' }, { label: 'Triggers' }]}
          />
          <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
            <div className='grid gap-2'>
              <h2 className='text-3xl font-medium max-sm:text-xl'>Triggers</h2>
              <p className='max-w-3xl text-sm text-secondary-foreground'>
                Bind automation definitions to app profiles and schedule-based invocation.
              </p>
            </div>
            <Button
              className='max-sm:w-full'
              disabled={!canCreate}
              onClick={openCreate}
            >
              <IconPlus className='size-4' />
              New trigger
            </Button>
          </div>
        </div>
      </section>

      {!canCreate ? (
        <AutomationEmptySplash variant='trigger-prerequisites' />
      ) : triggers.length === 0 ? (
        <AutomationEmptySplash
          variant='triggers'
          onAction={openCreate}
        />
      ) : (
        <section className='px-6 pb-16 pt-4 max-sm:px-4'>
          <AutomationTriggersTable
            applicationById={applicationById}
            automationById={automationById}
            busyId={busyId}
            triggers={triggers}
            onDelete={remove}
            onEdit={openEdit}
            onRun={runNow}
            onToggleEnabled={toggleEnabled}
          />
        </section>
      )}

      <Dialog
        open={Boolean(form)}
        onOpenChange={open => !open && setForm(null)}
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
                void save()
              }}
            >
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <label className='text-sm font-medium text-foreground'>Trigger details</label>
                <label className='flex items-center gap-3 text-sm text-foreground'>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={enabled => setForm(current => (current ? { ...current, enabled } : current))}
                  />
                  Enabled
                </label>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium text-foreground'>Name</label>
                <Input
                  value={form.name}
                  onChange={event => setForm(current => (current ? { ...current, name: event.target.value } : current))}
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium text-foreground'>Automation</label>
                <Select
                  value={form.automationId}
                  onValueChange={automationId => setForm(current => (current ? { ...current, automationId } : current))}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {initialAutomations.map(automation => (
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
                  onValueChange={updateTargetApplication}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {initialApplications.map(application => (
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
                onModeChange={profileMode => setForm(current => (current ? { ...current, profileMode } : current))}
                onNameChange={profileName => setForm(current => (current ? { ...current, profileName } : current))}
              />
              <ScheduleEditor
                schedule={form.schedule}
                onScheduleChange={patch =>
                  setForm(current => (current ? { ...current, schedule: { ...current.schedule, ...patch } } : current))
                }
              />
              <label className='flex items-center gap-2 text-sm text-foreground'>
                <Checkbox
                  checked={form.startPolicy === 'start-if-needed'}
                  onCheckedChange={checked =>
                    setForm(current =>
                      current
                        ? { ...current, startPolicy: checked === true ? 'start-if-needed' : 'require-running' }
                        : current
                    )
                  }
                />
                Start app before running if needed
              </label>
              <DialogFooter>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={saving}
                  onClick={() => setForm(null)}
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
    </ProtectedStackPageLayout>
  )
}

function AutomationTriggersTable({
  applicationById,
  automationById,
  busyId,
  triggers,
  onDelete,
  onEdit,
  onRun,
  onToggleEnabled
}: {
  applicationById: Map<string, AndroidApplication>
  automationById: Map<string, Automation>
  busyId: string | null
  triggers: AutomationTrigger[]
  onDelete: (trigger: AutomationTrigger) => Promise<void>
  onEdit: (trigger: AutomationTrigger) => void
  onRun: (trigger: AutomationTrigger) => Promise<void>
  onToggleEnabled: (trigger: AutomationTrigger, enabled: boolean) => Promise<void>
}) {
  return (
    <>
      <div className='hidden overflow-hidden rounded-lg border border-border/60 bg-background/25 lg:block'>
        <div className='overflow-x-auto'>
          <Table
            className='table-fixed'
            style={{ minWidth: '86rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-[22rem] px-4 py-3 uppercase'>Trigger</TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Target</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Schedule</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Next run</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Last trace</TableHead>
                <TableHead className='w-28 px-4 py-3 text-center uppercase'>Enabled</TableHead>
                <TableHead className='w-48 px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {triggers.map(trigger => {
                const automation = automationById.get(trigger.automationId)
                const application = applicationById.get(trigger.targetApplicationId)
                const busy = busyId === trigger.id

                return (
                  <TableRow
                    key={trigger.id}
                    className='hover:bg-secondary/22'
                  >
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='grid gap-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-medium text-foreground'>{trigger.name}</span>
                          <Badge variant='secondary'>Schedule</Badge>
                          <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
                        </div>
                        <span className='truncate text-sm text-secondary-foreground'>
                          {automation?.name ?? trigger.automationId}
                        </span>
                        <Visible when={trigger.lastError}>
                          <span className='truncate text-sm text-destructive'>{trigger.lastError}</span>
                        </Visible>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      <div className='grid gap-1'>
                        <span className='truncate text-foreground'>
                          {application?.name ?? trigger.targetApplicationId}
                        </span>
                        <span className='truncate'>
                          {trigger.profileName ?? 'default'} / {trigger.profileMode ?? 'persistent'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {scheduleLabel(getScheduleCron(trigger))}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {dateLabel(trigger.nextRunAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {dateLabel(trigger.lastRunAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-center align-top'>
                      <Switch
                        checked={trigger.enabled}
                        disabled={busy}
                        aria-label={`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.name}`}
                        onCheckedChange={enabled => void onToggleEnabled(trigger, enabled)}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={busy}
                          onClick={() => onEdit(trigger)}
                        >
                          <IconEdit className='size-4' />
                          Edit
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={busy}
                          onClick={() => void onRun(trigger)}
                        >
                          <IconPlayerPlayFilled className='size-4' />
                          Run
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          aria-label={`Delete ${trigger.name}`}
                          disabled={busy}
                          onClick={() => void onDelete(trigger)}
                        >
                          <IconTrash className='size-4 text-destructive' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25 lg:hidden'>
        {triggers.map(trigger => {
          const automation = automationById.get(trigger.automationId)
          const application = applicationById.get(trigger.targetApplicationId)
          const busy = busyId === trigger.id

          return (
            <div
              key={trigger.id}
              className='grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0'
            >
              <div className='flex min-w-0 items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <h3 className='font-medium text-foreground'>{trigger.name}</h3>
                  <p className='mt-1 text-sm text-secondary-foreground'>{automation?.name ?? trigger.automationId}</p>
                </div>
                <Switch
                  checked={trigger.enabled}
                  disabled={busy}
                  aria-label={`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.name}`}
                  onCheckedChange={enabled => void onToggleEnabled(trigger, enabled)}
                />
              </div>
              <div className='flex flex-wrap gap-2'>
                <Badge variant={trigger.enabled ? 'status' : 'secondary'}>
                  {trigger.enabled ? 'Enabled' : 'Paused'}
                </Badge>
                <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
              </div>
              <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
                <div className='col-span-2 grid gap-1'>
                  <dt className='text-secondary-foreground'>Target</dt>
                  <dd className='text-foreground'>
                    {application?.name ?? trigger.targetApplicationId} / {trigger.profileName ?? 'default'}
                  </dd>
                </div>
                <div className='col-span-2 grid gap-1'>
                  <dt className='text-secondary-foreground'>Schedule</dt>
                  <dd className='text-foreground'>{scheduleLabel(getScheduleCron(trigger))}</dd>
                </div>
                <div className='grid gap-1'>
                  <dt className='text-secondary-foreground'>Next</dt>
                  <dd className='text-foreground'>{dateLabel(trigger.nextRunAt)}</dd>
                </div>
                <div className='grid gap-1'>
                  <dt className='text-secondary-foreground'>Last</dt>
                  <dd className='text-foreground'>{dateLabel(trigger.lastRunAt)}</dd>
                </div>
                <Visible when={trigger.lastError}>
                  <div className='col-span-2 grid gap-1'>
                    <dt className='text-secondary-foreground'>Error</dt>
                    <dd className='text-destructive'>{trigger.lastError}</dd>
                  </div>
                </Visible>
              </dl>
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => onEdit(trigger)}
                >
                  <IconEdit className='size-4' />
                  Edit
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => void onRun(trigger)}
                >
                  <IconPlayerPlayFilled className='size-4' />
                  Run now
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={busy}
                  onClick={() => void onDelete(trigger)}
                >
                  <IconTrash className='size-4 text-destructive' />
                  Delete
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
