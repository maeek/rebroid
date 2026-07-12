'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  createAutomationTriggerAction,
  deleteAutomationTriggerAction,
  runAutomationTriggerAction,
  updateAutomationTriggerAction
} from '@/server/orchestrator/automations/automation-trigger-actions'
import { DataGridPagination } from '@/shared/ui/data-grid'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { sortFromSearchParam, sortToSearchParam } from '../shared/grid-query-utils'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
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
import { AutomationTriggersToolbar } from './automation-triggers-toolbar'
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
      toast({ title: 'Trigger deleted', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not delete trigger',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Automations' }}
        title='Triggers'
        description='Bind automation definitions to app profiles and schedule-based invocation.'
        actions={
          <Button
            disabled={!canCreate}
            onClick={openCreate}
          >
            <IconPlus className='size-4' />
            New trigger
          </Button>
        }
      />

      {!canCreate ? (
        <AutomationEmptySplash variant='trigger-prerequisites' />
      ) : triggersPage.total === 0 && !hasActiveTriggerFilters(gridQuery) ? (
        <AutomationEmptySplash
          variant='triggers'
          onAction={openCreate}
        />
      ) : (
        <PageContent className='grid gap-4 pt-2'>
          <AutomationTriggersToolbar
            applications={initialApplications}
            tags={triggersPage.facets.tags}
            gridQuery={gridQuery}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={value => pushGridParams({ q: value.trim() || undefined, page: 1 })}
            selectedCount={selectedTriggers.length}
            onUpdateGrid={pushGridParams}
            onDelete={() => setBulkDeleteOpen(true)}
            onDisable={() => void updateSelectedEnabled(false)}
            onEnable={() => void updateSelectedEnabled(true)}
          >
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
          </AutomationTriggersToolbar>
        </PageContent>
      )}

      <ConfirmMutationDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'trigger'}?`}
        description='This trigger will stop scheduling its workflow.'
        confirmLabel='Delete trigger'
        pendingLabel='Deleting…'
        pending={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onOpenChange={open => !open && setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />
      <ConfirmMutationDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedTriggers.length} selected triggers?`}
        description='The selected triggers will stop scheduling their workflows.'
        confirmLabel='Delete triggers'
        pendingLabel='Deleting…'
        pending={false}
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
    </StandardPage>
  )
}
