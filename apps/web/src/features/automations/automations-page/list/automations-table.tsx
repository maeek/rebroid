'use client'

import { useMemo, useRef, useState } from 'react'
import { parseAutomationGridSort } from '@rebroid/automation-core/grid-sort'
import { IconActivityHeartbeat, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { RowActionButton } from '@/components/ui/row-actions'
import { toast } from '@/hooks/use-toast'
import { deleteAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { successfulBulkIds, summarizeBulkResults } from '@/shared/actions/bulk-action-results'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { useResourceGridController } from '@/shared/ui/data-grid/use-resource-grid-controller'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { AutomationTagBadge } from '../shared/automation-tag-badge'
import { buildAutomationGridHref } from '../shared/grid-query-utils'
import { WorkflowRunDetailsLink, WorkflowRunStatus } from '../shared/workflow-run-result'
import { AutomationsTableToolbar } from './automations-table-toolbar'
import type { ApplicationName } from '@/shared/contracts/application'
import type { AutomationGridRow, AutomationsGridPage, AutomationsGridQuery } from '@/shared/contracts/automation'
import type { AutomationTag } from '@rebroid/automation-core/definition'
import type { ColumnDef } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

const WorkflowTags = ({ tags }: { tags: AutomationTag[] }) => {
  if (tags.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1 ${styles.settingsWideOnly}`}>
      {tags.map(tag => (
        <AutomationTagBadge
          key={tag.name}
          tag={tag}
        />
      ))}
    </div>
  )
}

const workflowStepLabel = (count: number) => {
  return `${count} ${count === 1 ? 'step' : 'steps'}`
}

export function AutomationsTable({
  applications,
  automationsPage,
  gridQuery: committedQuery,
  loading = false
}: {
  loading?: boolean
  applications: ApplicationName[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
}) {
  const router = useRouter()
  const grid = useResourceGridController({
    items: automationsPage.items,
    gridQuery: committedQuery,
    pageSize: automationsPage.pageSize,
    parseSort: sort => parseAutomationGridSort(sort, 'workflows'),
    buildHref: input => buildAutomationGridHref('/automations', input),
    history: 'push'
  })
  const { selectedIds, selectedItems: selectedAutomations } = grid
  const [pendingDelete, setPendingDelete] = useState<AutomationGridRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const deleting = useRef(false)
  const [busy, setBusy] = useState(false)
  const appNameById = useMemo(() => new Map(applications.map(app => [app.id, app.name])), [applications])

  const deleteMany = async (items: AutomationGridRow[]) => {
    if (deleting.current) return
    deleting.current = true
    setBusy(true)
    const results = await Promise.allSettled(items.map(item => deleteAutomationAction(item.id)))
    const deletedIds = successfulBulkIds(items, results)
    grid.deselectItems(deletedIds)
    setPendingDelete(null)
    setBulkDeleteOpen(false)
    deleting.current = false
    setBusy(false)
    router.refresh()
    toast({
      variant: 'success',
      ...summarizeBulkResults(
        results,
        items.length === 1 ? 'Workflow deleted' : 'Selected workflows deleted',
        'Some workflows could not be deleted'
      )
    })
  }

  const columns = useMemo<ColumnDef<AutomationGridRow>[]>(
    () => [
      {
        id: 'name',
        accessorFn: automation => automation.name,
        header: 'Workflow',
        size: 304,
        enableHiding: false,
        meta: {
          label: 'Workflow',
          compactSlot: 'title',
          skeleton: { kind: 'text', width: 'w-3/4' }
        },
        cell: ({ row }) => {
          const href = `/automations/${row.original.id}`
          return (
            <div className='grid gap-1'>
              <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                <ResourceLink
                  href={href}
                  className={`max-w-full truncate font-medium ${styles.settingsTouchTarget}`}
                  title={row.original.name}
                >
                  {row.original.name}
                </ResourceLink>
                <WorkflowTags tags={row.original.tags} />
              </div>
              {row.original.description ? (
                <span className={`line-clamp-1 text-xs text-foreground-muted ${styles.settingsWideOnly}`}>
                  {row.original.description}
                </span>
              ) : null}
            </div>
          )
        }
      },
      {
        id: 'apps',
        header: 'Apps',
        size: 176,
        enableSorting: false,
        meta: { label: 'Apps', skeleton: { kind: 'text', width: 'w-36' } },
        cell: ({ row }) => {
          const appIds = row.original.targetDeviceIds
          return (
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
              {appIds.length === 0 ? (
                <span className='text-foreground-muted'>—</span>
              ) : (
                appIds.map(id => (
                  <ResourceLink
                    key={id}
                    href={`/apps/${encodeURIComponent(id)}`}
                    className='max-w-full truncate'
                    title={appNameById.get(id) ?? id}
                  >
                    {appNameById.get(id) ?? id}
                  </ResourceLink>
                ))
              )}
            </div>
          )
        }
      },
      {
        id: 'steps',
        header: 'Steps',
        size: 96,
        enableSorting: false,
        meta: { label: 'Steps', compactSlot: 'details', skeleton: { kind: 'text', width: 'w-20' } },
        cell: ({ row }) => (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <span className='text-sm tabular-nums text-foreground-muted'>
              {workflowStepLabel(row.original.stepCount)}
            </span>
            <div className={styles.settingsOnly}>
              <WorkflowRunDetailsLink
                status={row.original.lastStatus}
                error={row.original.lastError}
                workflowId={row.original.id}
                runId={row.original.lastRunId}
              />
            </div>
          </div>
        )
      },
      {
        id: 'runStatus',
        header: 'Run status',
        size: 104,
        enableSorting: false,
        meta: { label: 'Run status', compactSlot: 'status', skeleton: { kind: 'badge' } },
        cell: ({ row }) => <WorkflowRunStatus status={row.original.lastStatus} />
      },
      {
        id: 'lastRunAt',
        accessorFn: automation => automation.lastRunAt ?? '',
        header: 'Last run',
        size: 272,
        meta: { label: 'Last run', compactSlot: 'sort', skeleton: { kind: 'text', width: 'w-28' } },
        cell: ({ row }) => (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <DateTimeValue
              value={row.original.lastRunAt}
              compact
              className='whitespace-nowrap'
            />
            <WorkflowRunDetailsLink
              status={row.original.lastStatus}
              error={row.original.lastError}
              workflowId={row.original.id}
              runId={row.original.lastRunId}
            />
          </div>
        )
      }
    ],
    [appNameById]
  )

  return (
    <div className='grid gap-4'>
      <AutomationsTableToolbar
        applications={applications}
        automationsPage={automationsPage}
        gridQuery={grid.query}
        search={grid.search}
        selectedCount={selectedAutomations.length}
        busy={busy || loading}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        onSearchChange={grid.setSearch}
        onSearchSubmit={grid.onSearch}
        onUpdateGrid={grid.pushGridParams}
      >
        <DataGrid
          loading={loading}
          columns={columns}
          data={automationsPage.items}
          totalItems={automationsPage.total}
          pageIndex={automationsPage.page - 1}
          pageSize={automationsPage.pageSize}
          getRowId={automation => automation.id}
          sorting={grid.sorting}
          onSortingChange={grid.onSortingChange}
          selection={{
            disabled: busy || loading,
            selectedIds,
            onSelectedIdsChange: grid.setSelectedIds
          }}
          minWidth='60rem'
          emptyState={
            <DataGridEmptyState
              headingLevel={2}
              artwork='workflow'
              artworkSize='page'
              title='No workflows yet'
              description='Create a workflow to reuse a sequence of device actions.'
            />
          }
          rowContextMenu={row => {
            const hasBulkSelection = selectedIds.has(row.original.id) && selectedAutomations.length > 1
            return (
              <>
                {hasBulkSelection ? (
                  <ContextMenuItem
                    className='text-danger focus:text-danger'
                    disabled={busy}
                    onSelect={() => setBulkDeleteOpen(true)}
                  >
                    <IconTrash className='size-4' />
                    Delete selected ({selectedAutomations.length})
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem
                  disabled={busy}
                  onSelect={() => router.push(`/automations/${encodeURIComponent(row.original.id)}/traces`)}
                >
                  <IconActivityHeartbeat className='size-4' />
                  Run history
                </ContextMenuItem>
                <ContextMenuItem
                  className='text-danger focus:text-danger'
                  disabled={busy}
                  onSelect={() => setPendingDelete(row.original)}
                >
                  <IconTrash className='size-4' />
                  Delete
                </ContextMenuItem>
              </>
            )
          }}
          rowQuickAction={({ original }) => (
            <RowActionButton
              asChild
              label={`Run history for ${original.name}`}
            >
              <Link href={`/automations/${encodeURIComponent(original.id)}/traces`}>
                <IconActivityHeartbeat className='size-4' />
              </Link>
            </RowActionButton>
          )}
        />
        <DataGridPagination
          loading={loading}
          itemLabels={{ singular: 'workflow', plural: 'workflows' }}
          totalItems={automationsPage.total}
          pageIndex={automationsPage.page - 1}
          pageSize={automationsPage.pageSize}
          onPageIndexChange={grid.onPageIndexChange}
          onPageSizeChange={grid.onPageSizeChange}
        />
      </AutomationsTableToolbar>

      <ConfirmMutationDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'workflow'}?`}
        description='Rebroid deletes the workflow and its triggers and keeps past runs.'
        confirmLabel='Delete workflow'
        pendingLabel='Deleting…'
        pending={busy}
        onOpenChange={open => !open && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteMany([pendingDelete])
        }}
      />
      <ConfirmMutationDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedAutomations.length} selected workflows?`}
        description='Rebroid deletes the selected workflows and their triggers and keeps past runs.'
        confirmLabel='Delete workflows'
        pendingLabel='Deleting…'
        pending={busy}
        onOpenChange={open => !open && setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteMany(selectedAutomations)
        }}
      />
    </div>
  )
}
