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
import { unwrapActionResult } from '@/shared/actions/action-result'
import { successfulBulkIds, summarizeBulkResults } from '@/shared/actions/bulk-action-results'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { useResourceGridController } from '@/shared/ui/data-grid/use-resource-grid-controller'
import { CompactPageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { buildAutomationTagCatalog } from '../shared/automation-tags'
import { buildAutomationGridHref } from '../shared/grid-query-utils'
import { AutomationTriggerFormDialog } from './automation-trigger-form-dialog'
import {
  applyTriggerTargetApplication,
  applyTriggerWorkflow,
  editTriggerFormState,
  newTriggerFormState,
  triggerFormSavePayload,
  triggerFormUpdatePayload
} from './automation-triggers-page-model'
import { AutomationTriggersTable } from './automation-triggers-table'
import { AutomationTriggersToolbar } from './automation-triggers-toolbar'
import type { TriggerFormState } from './automation-trigger-types'
import type { AutomationTriggersPageProps } from '../editor/types'
import type { AutomationRun, AutomationTrigger } from '@/shared/contracts/automation'

export function AutomationTriggersPage({
  initialApplications,
  initialAutomations,
  triggersPage,
  gridQuery: committedQuery,
  targetApps,
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
  const grid = useResourceGridController({
    items: triggersPage.items,
    gridQuery: committedQuery,
    pageSize: triggersPage.pageSize,
    parseSort: sort => parseAutomationGridSort(sort, 'triggers'),
    buildHref: input => buildAutomationGridHref('/automations/triggers', input),
    history: 'push'
  })
  const { selectedIds, selectedItems: selectedTriggers } = grid
  const [pendingDelete, setPendingDelete] = useState<AutomationTrigger | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  useEffect(() => {
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
  const targetById = useMemo(() => new Map(targetApps.map(app => [app.id, app])), [targetApps])
  const selectedApplication = form ? targetById.get(form.targetApplicationId) : undefined
  const tagSuggestions = useMemo(
    () =>
      buildAutomationTagCatalog(triggersPage.facets.tags, [
        ...triggersPage.items.flatMap(trigger => trigger.tags),
        ...initialAutomations.flatMap(automation => automation.tags)
      ]),
    [triggersPage.facets.tags, triggersPage.items, initialAutomations]
  )
  const canCreate = initialAutomations.length > 0 && targetApps.length > 0

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
    const app = targetById.get(trigger.targetApplicationId)
    const next = editTriggerFormState({ trigger, app })
    setForm(next)
    setBaselineForm(next)
    setFormOpen(true)
  }

  const updateTargetApplication = (targetApplicationId: string) => {
    const app = targetById.get(targetApplicationId)
    setForm(current =>
      current
        ? applyTriggerTargetApplication(
            current,
            targetApplicationId,
            app,
            automationById.get(current.automationId),
            targetById.get(current.targetApplicationId)
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
            targetById.get(current.targetApplicationId)
          )
        : current
    )
  }

  const save = async () => {
    if (!form || mutationPending.current) return
    if (form.id && !baselineForm) return
    if (!automationById.has(form.automationId) || !selectedApplication) return
    mutationPending.current = true
    setSaving(true)
    try {
      if (form.id && baselineForm) {
        unwrapActionResult(await updateAutomationTriggerAction(form.id, triggerFormUpdatePayload(form, baselineForm)))
      } else {
        unwrapActionResult(await createAutomationTriggerAction(triggerFormSavePayload(form)))
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
        unwrapActionResult(await updateAutomationTriggerAction(trigger.id, { enabled }))
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
      const run = unwrapActionResult(await runAutomationTriggerAction(trigger.id))
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
      unwrapActionResult(await deleteAutomationTriggerAction(trigger.id))
      grid.deselectItems(new Set([trigger.id]))
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
      grid.deselectItems(updated)
      router.refresh()
      toast({
        variant: 'success',
        ...summarizeBulkResults(
          results,
          enabled ? 'Selected triggers enabled' : 'Selected triggers disabled',
          'Some triggers could not be updated'
        )
      })
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
      const deletedIds = successfulBulkIds(items, results)
      grid.deselectItems(deletedIds)
      setBulkDeleteOpen(false)
      router.refresh()
      toast({
        variant: 'success',
        ...summarizeBulkResults(results, 'Selected triggers deleted', 'Some triggers could not be deleted')
      })
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
          gridQuery={grid.query}
          search={grid.search}
          onSearchChange={grid.setSearch}
          onSearchSubmit={grid.onSearch}
          selectedCount={selectedTriggers.length}
          pending={bulkPending}
          disabled={busy}
          onUpdateGrid={grid.pushGridParams}
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
            sorting={grid.sorting}
            triggers={triggersPage.items}
            triggerRuns={triggerRuns}
            onDelete={setPendingDelete}
            onDeleteSelected={() => setBulkDeleteOpen(true)}
            onDisableSelected={() => updateSelectedEnabled(false)}
            onEdit={openEdit}
            onEnableSelected={() => updateSelectedEnabled(true)}
            onRun={canRun ? runNow : undefined}
            onSelectedIdsChange={grid.setSelectedIds}
            onSortingChange={grid.onSortingChange}
            onToggleEnabled={toggleEnabled}
            toggleFeedback={toggleFeedback}
          />
          <DataGridPagination
            loading={loading}
            totalItems={triggersPage.total}
            pageIndex={triggersPage.page - 1}
            pageSize={triggersPage.pageSize}
            onPageIndexChange={grid.onPageIndexChange}
            onPageSizeChange={grid.onPageSizeChange}
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
