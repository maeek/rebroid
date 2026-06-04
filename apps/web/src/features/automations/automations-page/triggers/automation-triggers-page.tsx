'use client'

import { useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  cronToSchedule,
  defaultSchedule,
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
import { AutomationDeleteDialog } from '../shared/automation-delete-dialog'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { AutomationTriggerFilters } from './automation-trigger-filters'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
  appProfileMode,
  appProfileName,
  getScheduleCron,
  getStartPolicy,
  matchesLastRun,
  type LastRunFilter
} from './automation-trigger-utils'
import { AutomationTriggersTable } from './automation-triggers-table'
import type { TriggerFormState } from './automation-trigger-types'
import type { AutomationTriggersPageProps } from '../editor/types'
import type { AndroidApplication, ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationTrigger } from '@/server/orchestrator/automations/types'

const defaultTriggerName = (automation: Automation | undefined, app: AndroidApplication | undefined) => {
  if (automation && app) return `${automation.name} on ${app.name}`
  return 'New workflow trigger'
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [appFilter, setAppFilter] = useState('all')
  const [enabledFilter, setEnabledFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastRunFilter, setLastRunFilter] = useState<LastRunFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<AutomationTrigger | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

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
  const tags = useMemo(
    () =>
      Array.from(new Set(triggers.flatMap(trigger => trigger.tags))).sort((left, right) => left.localeCompare(right)),
    [triggers]
  )
  const filteredTriggers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return triggers.filter(trigger => {
      const automation = automationById.get(trigger.automationId)
      const application = applicationById.get(trigger.targetApplicationId)
      return (
        (!query ||
          trigger.name.toLowerCase().includes(query) ||
          (automation?.name ?? '').toLowerCase().includes(query) ||
          (application?.name ?? '').toLowerCase().includes(query)) &&
        (tagFilter === 'all' || trigger.tags.includes(tagFilter)) &&
        (appFilter === 'all' || trigger.targetApplicationId === appFilter) &&
        (enabledFilter === 'all' || String(trigger.enabled) === enabledFilter) &&
        (statusFilter === 'all' || trigger.lastStatus === statusFilter) &&
        matchesLastRun(trigger, lastRunFilter)
      )
    })
  }, [
    appFilter,
    applicationById,
    automationById,
    enabledFilter,
    lastRunFilter,
    search,
    statusFilter,
    tagFilter,
    triggers
  ])
  const selectedTriggers = filteredTriggers.filter(trigger => selectedIds.has(trigger.id))
  const allSelected = filteredTriggers.length > 0 && selectedTriggers.length === filteredTriggers.length

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
      tags: [],
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
      tags: trigger.tags,
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
        tags: form.tags,
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
    setBusyId(trigger.id)
    try {
      await deleteAutomationTriggerAction(trigger.id)
      setTriggers(current => current.filter(item => item.id !== trigger.id))
      setSelectedIds(current => new Set(Array.from(current).filter(id => id !== trigger.id)))
      setPendingDelete(null)
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

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredTriggers.map(trigger => trigger.id)))
  }

  const updateSelectedEnabled = async (enabled: boolean) => {
    const items = selectedTriggers
    const results = await Promise.allSettled(
      items.map(trigger => updateAutomationTriggerAction(trigger.id, { enabled }))
    )
    const updated = results.filter(
      (result): result is PromiseFulfilledResult<AutomationTrigger> => result.status === 'fulfilled'
    )
    const failedCount = results.length - updated.length
    setTriggers(current => current.map(item => updated.find(result => result.value.id === item.id)?.value ?? item))
    toast(
      failedCount > 0
        ? {
            title: 'Some triggers could not be updated',
            description: `${failedCount} update request failed.`,
            variant: 'destructive'
          }
        : { title: enabled ? 'Selected triggers enabled' : 'Selected triggers disabled' }
    )
  }

  const deleteSelected = async () => {
    const items = selectedTriggers
    const results = await Promise.allSettled(items.map(trigger => deleteAutomationTriggerAction(trigger.id)))
    const deletedIds = new Set(
      results
        .map((result, index) => (result.status === 'fulfilled' ? items[index]?.id : null))
        .filter((id): id is string => Boolean(id))
    )
    const failedCount = results.length - deletedIds.size
    setTriggers(current => current.filter(item => !deletedIds.has(item.id)))
    setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
    setBulkDeleteOpen(false)
    toast(
      failedCount > 0
        ? {
            title: 'Some triggers could not be deleted',
            description: `${failedCount} delete request failed.`,
            variant: 'destructive'
          }
        : { title: 'Selected triggers deleted' }
    )
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
          <AutomationTriggerFilters
            applications={initialApplications}
            appFilter={appFilter}
            enabledFilter={enabledFilter}
            lastRunFilter={lastRunFilter}
            search={search}
            selectedCount={selectedTriggers.length}
            statusFilter={statusFilter}
            tagFilter={tagFilter}
            tags={tags}
            onBulkDelete={() => setBulkDeleteOpen(true)}
            onBulkEnabledChange={enabled => void updateSelectedEnabled(enabled)}
            onFilterApp={setAppFilter}
            onFilterEnabled={setEnabledFilter}
            onFilterLastRun={setLastRunFilter}
            onFilterStatus={setStatusFilter}
            onFilterTag={setTagFilter}
            onSearchChange={setSearch}
          />
          <AutomationTriggersTable
            applicationById={applicationById}
            automationById={automationById}
            allSelected={allSelected}
            busyId={busyId}
            selectedIds={selectedIds}
            triggers={filteredTriggers}
            onDelete={setPendingDelete}
            onEdit={openEdit}
            onRun={runNow}
            onToggleAll={toggleAll}
            onToggleEnabled={toggleEnabled}
            onToggleSelected={toggleSelected}
          />
        </section>
      )}

      <AutomationDeleteDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'trigger'}?`}
        description='This trigger will stop scheduling its workflow.'
        busy={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onOpenChange={open => !open && setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />
      <AutomationDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedTriggers.length} selected triggers?`}
        description='The selected triggers will stop scheduling their workflows.'
        busy={false}
        onOpenChange={open => !open && setBulkDeleteOpen(false)}
        onConfirm={() => void deleteSelected()}
      />

      <AutomationTriggerFormDialog
        applications={initialApplications}
        automations={initialAutomations}
        form={form}
        saving={saving}
        selectedApplication={selectedApplication}
        onOpenChange={open => !open && setForm(null)}
        onSave={() => void save()}
        onUpdateForm={updater => setForm(current => (current ? updater(current) : current))}
        onUpdateTargetApplication={updateTargetApplication}
      />
    </ProtectedStackPageLayout>
  )
}
