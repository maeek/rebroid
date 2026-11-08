'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { serializeSortParam } from '@/shared/model/search-params'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationEmptySplash } from '../shared/automation-empty-splash'
import { buildAutomationTagCatalog } from '../shared/automation-tags'
import { sortFromSearchParam } from '../shared/grid-query-utils'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
  applyTriggerTargetApplication,
  applyTriggerWorkflow,
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
import type { AutomationTrigger, AutomationTriggersGridQuery } from '@/shared/contracts/automation'

export function AutomationTriggersPage({
  initialApplications,
  initialAutomations,
  triggersPage,
  gridQuery,
  loading = false
}: AutomationTriggersPageProps) {
  const router = useRouter()
  const [form, setForm] = useState<TriggerFormState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const mutationPending = useRef(false)
  const [bulkPending, setBulkPending] = useState<'enable' | 'disable' | 'delete' | null>(null)
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
  const tagSuggestions = useMemo(
    () =>
      buildAutomationTagCatalog(triggersPage.facets.tags, [
        ...triggersPage.items.flatMap(trigger => trigger.tags),
        ...initialAutomations.flatMap(automation => automation.tags)
      ]),
    [triggersPage.facets.tags, triggersPage.items, initialAutomations]
  )
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
    setFormOpen(true)
  }

  const openEdit = (trigger: AutomationTrigger) => {
    const app = applicationById.get(trigger.targetApplicationId)
    setForm(editTriggerFormState({ trigger, app }))
    setFormOpen(true)
  }

  const updateTargetApplication = (targetApplicationId: string) => {
    const app = applicationById.get(targetApplicationId)
    setForm(current =>
      current
        ? applyTriggerTargetApplication(
            current,
            targetApplicationId,
            app,
            automationById.get(current.automationId),
            applicationById.get(current.targetApplicationId)
          )
        : current
    )
  }

  const updateWorkflow = (automationId: string) => {
    setForm(current =>
      current
        ? applyTriggerWorkflow(
            current,
            automationById.get(automationId),
            automationById.get(current.automationId),
            applicationById.get(current.targetApplicationId)
          )
        : current
    )
  }

  const save = async () => {
    if (!form || mutationPending.current) return
    if (!automationById.has(form.automationId) || !applicationById.has(form.targetApplicationId)) return
    mutationPending.current = true
    setSaving(true)
    try {
      const payload = triggerFormSavePayload(form)
      await (form.id ? updateAutomationTriggerAction(form.id, payload) : createAutomationTriggerAction(payload))
      setFormOpen(false)
      router.refresh()
      toast({ title: form.id ? 'Trigger updated' : 'Trigger created', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save trigger',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
      setSaving(false)
    }
  }

  const toggleEnabled = async (trigger: AutomationTrigger, enabled: boolean) => {
    if (mutationPending.current) return
    mutationPending.current = true
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
      mutationPending.current = false
      setBusyId(null)
    }
  }

  const runNow = async (trigger: AutomationTrigger) => {
    if (mutationPending.current) return
    mutationPending.current = true
    setBusyId(trigger.id)
    try {
      const run = await runAutomationTriggerAction(trigger.id)
      router.refresh()
      toast({
        title: 'Workflow queued',
        description: `Run ${run.id.slice(0, 8)} was added to the queue.`,
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Could not run trigger',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
      setBusyId(null)
    }
  }

  const remove = async (trigger: AutomationTrigger) => {
    if (mutationPending.current) return
    mutationPending.current = true
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
      mutationPending.current = false
      setBusyId(null)
    }
  }

  const updateSelectedEnabled = async (enabled: boolean) => {
    if (mutationPending.current || selectedTriggers.length === 0) return
    mutationPending.current = true
    setBulkPending(enabled ? 'enable' : 'disable')
    try {
      const results = await Promise.allSettled(
        selectedTriggers.map(trigger => updateAutomationTriggerAction(trigger.id, { enabled }))
      )
      router.refresh()
      toast(summarizeTriggerBulkUpdateResults(results, enabled))
    } finally {
      mutationPending.current = false
      setBulkPending(null)
    }
  }

  const deleteSelected = async () => {
    if (mutationPending.current || selectedTriggers.length === 0) return
    mutationPending.current = true
    setBulkPending('delete')
    try {
      const items = selectedTriggers
      const results = await Promise.allSettled(items.map(trigger => deleteAutomationTriggerAction(trigger.id)))
      const deletedIds = deletedTriggerIdsFromResults(results, items)
      setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
      setBulkDeleteOpen(false)
      router.refresh()
      toast(summarizeTriggerBulkDeleteResults(results, deletedIds))
    } finally {
      mutationPending.current = false
      setBulkPending(null)
    }
  }

  const busy = loading || saving || busyId !== null || bulkPending !== null

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Automations' }}
        title='Triggers'
        description='Run workflows on a schedule for a specific app and profile.'
        actions={
          <Button
            disabled={!canCreate || busy}
            onClick={openCreate}
          >
            <IconPlus className='size-4' />
            New trigger
          </Button>
        }
      />

      {!loading && !canCreate && triggersPage.total === 0 && !hasActiveTriggerFilters(gridQuery) ? (
        <AutomationEmptySplash variant='trigger-prerequisites' />
      ) : !loading && triggersPage.total === 0 && !hasActiveTriggerFilters(gridQuery) ? (
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
            pending={bulkPending}
            disabled={busy}
            onUpdateGrid={pushGridParams}
            onDelete={() => setBulkDeleteOpen(true)}
            onDisable={() => void updateSelectedEnabled(false)}
            onEnable={() => void updateSelectedEnabled(true)}
          >
            <AutomationTriggersTable
              loading={loading}
              applicationById={applicationById}
              automationById={automationById}
              busyId={busyId}
              disabled={busy}
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
              onSortingChange={nextSorting => pushGridParams({ sort: serializeSortParam(nextSorting), page: 1 })}
              onToggleEnabled={toggleEnabled}
            />
            <DataGridPagination
              loading={loading}
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
        pending={bulkPending === 'delete'}
        onOpenChange={open => !open && setBulkDeleteOpen(false)}
        onConfirm={() => void deleteSelected()}
      />

      <AutomationTriggerFormDialog
        tagSuggestions={tagSuggestions}
        onUpdateWorkflow={updateWorkflow}
        open={formOpen}
        onOpenChangeComplete={open => {
          if (!open) setForm(null)
        }}
        applications={initialApplications}
        automations={initialAutomations}
        form={form}
        saving={saving}
        selectedApplication={selectedApplication}
        onOpenChange={open => !saving && setFormOpen(open)}
        onSave={() => void save()}
        onUpdateForm={updater => setForm(current => (current ? updater(current) : current))}
        onUpdateTargetApplication={updateTargetApplication}
      />
    </StandardPage>
  )
}
