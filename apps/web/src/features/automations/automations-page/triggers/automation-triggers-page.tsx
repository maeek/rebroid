'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationTriggerAction,
  deleteAutomationTriggerAction,
  runAutomationTriggerAction,
  updateAutomationTriggerAction
} from '@/server/orchestrator/automations/automation-trigger-actions'
import { DataGridPagination } from '@/shared/ui/data-grid'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { AutomationDeleteDialog } from '../shared/automation-delete-dialog'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { sortFromSearchParam, sortToSearchParam } from '../shared/grid-query-utils'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
  activeTriggerFilterCount,
  applyTriggerTargetApplication,
  buildAutomationTriggersGridHref,
  deletedTriggerIdsFromResults,
  editTriggerFormState,
  hasActiveTriggerFilters,
  newTriggerFormState,
  retainVisibleTriggerSelection,
  selectedTriggersFromIds,
  summarizeTriggerBulkDeleteResults,
  summarizeTriggerBulkUpdateResults,
  triggerFormSavePayload
} from './automation-triggers-page-model'
import { AutomationTriggersTable } from './automation-triggers-table'
import { AutomationTriggerBulkBar, AutomationTriggersToolbar } from './automation-triggers-toolbar'
import type { TriggerFormState } from './automation-trigger-types'
import type { AutomationTriggersPageProps } from '../editor/types'
import type { AutomationTrigger, AutomationTriggersGridQuery } from '@/server/orchestrator/automations/types'

export function AutomationTriggersPage({
  initialApplications,
  initialAutomations,
  triggersPage,
  gridQuery
}: AutomationTriggersPageProps) {
  const router = useRouter()
  const [form, setForm] = useState<TriggerFormState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [pendingDelete, setPendingDelete] = useState<AutomationTrigger | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const sorting = useMemo(() => sortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisibleTriggerSelection(triggersPage.items, current))
  }, [triggersPage.items])

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
  const selectedTriggers = selectedTriggersFromIds(triggersPage.items, selectedIds)

  const pushGridParams = (patch: Partial<AutomationTriggersGridQuery>) => {
    router.push(buildAutomationTriggersGridHref({ gridQuery, pageSize: triggersPage.pageSize, patch }))
  }

  const openCreate = () => {
    const automation = initialAutomations[0]
    const app = initialApplications[0]
    if (!automation || !app) return

    setForm(newTriggerFormState({ automation, app }))
  }

  const openEdit = (trigger: AutomationTrigger) => {
    const app = applicationById.get(trigger.targetApplicationId)
    setForm(editTriggerFormState({ trigger, app }))
  }

  const updateTargetApplication = (targetApplicationId: string) => {
    const app = applicationById.get(targetApplicationId)
    setForm(current => (current ? applyTriggerTargetApplication(current, targetApplicationId, app) : current))
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const payload = triggerFormSavePayload(form)
      await (form.id ? updateAutomationTriggerAction(form.id, payload) : createAutomationTriggerAction(payload))
      setForm(null)
      router.refresh()
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
      await updateAutomationTriggerAction(trigger.id, { enabled })
      router.refresh()
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
      router.refresh()
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
      setSelectedIds(current => new Set(Array.from(current).filter(id => id !== trigger.id)))
      setPendingDelete(null)
      router.refresh()
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

  const updateSelectedEnabled = async (enabled: boolean) => {
    const items = selectedTriggers
    const results = await Promise.allSettled(
      items.map(trigger => updateAutomationTriggerAction(trigger.id, { enabled }))
    )
    router.refresh()
    toast(summarizeTriggerBulkUpdateResults(results, enabled))
  }

  const deleteSelected = async () => {
    const items = selectedTriggers
    const results = await Promise.allSettled(items.map(trigger => deleteAutomationTriggerAction(trigger.id)))
    const deletedIds = deletedTriggerIdsFromResults(results, items)
    setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
    setBulkDeleteOpen(false)
    router.refresh()
    toast(summarizeTriggerBulkDeleteResults(results, deletedIds))
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
              <p className='max-w-3xl text-sm text-foreground-muted'>
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
      ) : triggersPage.total === 0 && !hasActiveTriggerFilters(gridQuery) ? (
        <AutomationEmptySplash
          variant='triggers'
          onAction={openCreate}
        />
      ) : (
        <section className='grid gap-4 px-6 pb-16 pt-4 max-sm:px-4'>
          <AutomationTriggersToolbar
            applications={initialApplications}
            tags={triggersPage.facets.tags}
            gridQuery={gridQuery}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={() => pushGridParams({ q: search.trim() || undefined, page: 1 })}
            activeFilterCount={activeTriggerFilterCount(gridQuery)}
            selectedCount={selectedTriggers.length}
            onUpdateGrid={pushGridParams}
          />

          <AutomationTriggerBulkBar
            selectedCount={selectedTriggers.length}
            onDelete={() => setBulkDeleteOpen(true)}
            onDisable={() => void updateSelectedEnabled(false)}
            onEnable={() => void updateSelectedEnabled(true)}
          />

          <AutomationTriggersTable
            applicationById={applicationById}
            automationById={automationById}
            busyId={busyId}
            selectedIds={selectedIds}
            sorting={sorting}
            triggers={triggersPage.items}
            onDelete={setPendingDelete}
            onDeleteSelected={() => setBulkDeleteOpen(true)}
            onDisableSelected={() => updateSelectedEnabled(false)}
            onEdit={openEdit}
            onEnableSelected={() => updateSelectedEnabled(true)}
            onRun={runNow}
            onSelectedIdsChange={setSelectedIds}
            onSortingChange={nextSorting => pushGridParams({ sort: sortToSearchParam(nextSorting), page: 1 })}
            onToggleEnabled={toggleEnabled}
          />
          <DataGridPagination
            totalItems={triggersPage.total}
            pageIndex={triggersPage.page - 1}
            pageSize={triggersPage.pageSize}
            onPageIndexChange={pageIndex => pushGridParams({ page: pageIndex + 1 })}
            onPageSizeChange={pageSize => pushGridParams({ page: 1, pageSize })}
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
