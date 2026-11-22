'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { parseAutomationGridSort } from '@rebroid/automation-core/grid-sort'
import { IconPlus } from '@tabler/icons-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { useImmediateSave } from '@/hooks/use-immediate-save'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  createAutomationTriggerAction,
  deleteAutomationTriggerAction,
  runAutomationTriggerAction,
  updateAutomationTriggerAction
} from '@/server/orchestrator/automations/automation-trigger-actions'
import { successfulBulkIds } from '@/shared/actions/bulk-action-results'
import { serializeSortParam } from '@/shared/model/search-params'
import { retainVisibleSelectedIds } from '@/shared/model/visible-selection'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { buildAutomationTagCatalog } from '../shared/automation-tags'
import { buildAutomationGridHref } from '../shared/grid-query-utils'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
  applyTriggerTargetApplication,
  applyTriggerWorkflow,
  deletedTriggerIdsFromResults,
  editTriggerFormState,
  newTriggerFormState,
  selectedTriggersFromIds,
  summarizeTriggerBulkDeleteResults,
  summarizeTriggerBulkUpdateResults,
  triggerFormSavePayload,
  triggerFormUpdatePayload
} from './automation-triggers-page-model'
import { AutomationTriggersTable } from './automation-triggers-table'
import { AutomationTriggersToolbar } from './automation-triggers-toolbar'
import type { TriggerFormState } from './automation-trigger-types'
import type { AutomationTriggersPageProps } from '../editor/types'
import type { AutomationRun, AutomationTrigger, AutomationTriggersGridQuery } from '@/shared/contracts/automation'

export function AutomationTriggersPage({
  initialApplications,
  initialAutomations,
  triggersPage,
  gridQuery,
  ownedAppIds,
  canRun = false,
  canCreateApp = false,
  loading = false
}: AutomationTriggersPageProps) {
  const router = useRouter()
  const createRequested = useSearchParams()?.get('create') === '1'
  const [form, setForm] = useState<TriggerFormState | null>(null)
  const [baselineForm, setBaselineForm] = useState<TriggerFormState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const toggleFeedback = useImmediateSave()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [triggerRuns, setTriggerRuns] = useState<ReadonlyMap<string, AutomationRun | null>>(() => new Map())
  const enqueuingTriggers = useRef(new Set<string>())
  const mutationPending = useRef(false)
  const [bulkPending, setBulkPending] = useState<'enable' | 'disable' | 'delete' | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [pendingDelete, setPendingDelete] = useState<AutomationTrigger | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const sorting = useMemo(() => parseAutomationGridSort(gridQuery.sort, 'triggers'), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisibleSelectedIds(triggersPage.items, current))
    setTriggerRuns(current => {
      const observed = triggersPage.items.filter(trigger => {
        const receipt = current.get(trigger.id)
        return receipt && (trigger.lastRunId === receipt.id || (trigger.lastRunAt ?? '') > receipt.createdAt)
      })
      if (observed.length === 0) return current
      const next = new Map(current)
      for (const trigger of observed) next.delete(trigger.id)
      return next
    })
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
  const targetApps = ownedAppIds ? initialApplications.filter(app => ownedAppIds.includes(app.id)) : initialApplications
  const canCreate = initialAutomations.length > 0 && targetApps.length > 0
  const selectedTriggers = selectedTriggersFromIds(triggersPage.items, selectedIds)

  const pushGridParams = (patch: Partial<AutomationTriggersGridQuery>) => {
    router.push(buildAutomationGridHref('/automations/triggers', { gridQuery, pageSize: triggersPage.pageSize, patch }))
  }

  const openCreate = () => {
    const automation = initialAutomations[0]
    const app = targetApps[0]
    if (!automation || !app) return

    setForm(newTriggerFormState({ automation, app }))
    setBaselineForm(null)
    setFormOpen(true)
  }

  const openFromShortcut = useEffectEvent(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('create')
    window.history.replaceState(null, '', url)
    openCreate()
  })

  useEffect(() => {
    if (createRequested && !loading && !saving && !formOpen) openFromShortcut()
  }, [createRequested, loading, saving, formOpen])

  const openEdit = (trigger: AutomationTrigger) => {
    const app = applicationById.get(trigger.targetApplicationId)
    const next = editTriggerFormState({ trigger, app })
    setForm(next)
    setBaselineForm(next)
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
    if (form.id && !baselineForm) return
    if (!automationById.has(form.automationId) || !applicationById.has(form.targetApplicationId)) return
    mutationPending.current = true
    setSaving(true)
    try {
      if (form.id && baselineForm) {
        await updateAutomationTriggerAction(form.id, triggerFormUpdatePayload(form, baselineForm))
      } else {
        await createAutomationTriggerAction(triggerFormSavePayload(form))
      }
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
      await toggleFeedback.save(trigger.id, async () => {
        await updateAutomationTriggerAction(trigger.id, { enabled })
        router.refresh()
      })
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
    if (mutationPending.current || enqueuingTriggers.current.has(trigger.id)) return
    const previousRun = triggerRuns.get(trigger.id)
    enqueuingTriggers.current.add(trigger.id)
    setTriggerRuns(current => new Map(current).set(trigger.id, null))
    try {
      const run = await runAutomationTriggerAction(trigger.id)
      setTriggerRuns(current => new Map(current).set(trigger.id, run))
      router.refresh()
    } catch (error) {
      setTriggerRuns(current => {
        const next = new Map(current)
        if (previousRun) next.set(trigger.id, previousRun)
        else next.delete(trigger.id)
        return next
      })
      toast({
        title: 'Could not run trigger',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      enqueuingTriggers.current.delete(trigger.id)
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
      const updated = successfulBulkIds(selectedTriggers, results)
      setSelectedIds(current => new Set([...current].filter(id => !updated.has(id))))
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
    <StandardPage
      gridToolbar
      className='gap-2'
    >
      <CompactPageHeader
        section={{ label: 'Automations' }}
        title='Triggers'
        description='Run workflows on a schedule for a specific app and profile.'
        actions={
          canCreate || loading ? (
            <Button
              disabled={!canCreate || busy}
              onClick={openCreate}
            >
              <IconPlus className='size-4' />
              New trigger
            </Button>
          ) : undefined
        }
      />

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
            missingApps={targetApps.length === 0}
            missingWorkflows={initialAutomations.length === 0}
            canCreateApp={canCreateApp}
            applicationById={applicationById}
            automationById={automationById}
            busyId={busyId}
            disabled={busy}
            selectedIds={selectedIds}
            sorting={sorting}
            triggers={triggersPage.items}
            triggerRuns={triggerRuns}
            onDelete={setPendingDelete}
            onDeleteSelected={() => setBulkDeleteOpen(true)}
            onDisableSelected={() => updateSelectedEnabled(false)}
            onEdit={openEdit}
            onEnableSelected={() => updateSelectedEnabled(true)}
            onRun={canRun ? runNow : undefined}
            onSelectedIdsChange={setSelectedIds}
            onSortingChange={nextSorting => pushGridParams({ sort: serializeSortParam(nextSorting), page: 1 })}
            onToggleEnabled={toggleEnabled}
            toggleFeedback={toggleFeedback}
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
        baseline={baselineForm}
        tagSuggestions={tagSuggestions}
        onUpdateWorkflow={updateWorkflow}
        open={formOpen}
        onOpenChangeComplete={open => {
          if (!open) setForm(null)
        }}
        applications={targetApps}
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
