'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconActivityHeartbeat, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { deleteAutomationAction } from '@/server/orchestrator/automations/actions'
import { AutomationDeleteDialog } from '../shared/automation-delete-dialog'
import { AutomationTagBadge } from '../shared/automation-tag-badge'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationDefinitionStep,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTag,
  AutomationTrigger
} from '@/server/orchestrator/automations/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const allFilterValue = 'all'

const statusVariant = (status: Automation['lastStatus']) => {
  if (status === 'success') return 'status'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

const statusLabel = (status: Automation['lastStatus']) => {
  if (status === 'never_run') return 'Never run'
  return status === 'success' ? 'Success' : status === 'running' ? 'Running' : 'Failed'
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '-'

const stepCount = (steps: AutomationDefinitionStep[]): number =>
  steps.reduce((count, step) => {
    if ('uses' in step) return count + 1
    if (step.type === 'condition') return count + 1 + stepCount(step.then) + stepCount(step.else ?? [])
    if (step.type === 'switch') {
      return (
        count + 1 + step.cases.reduce((sum, item) => sum + stepCount(item.steps), 0) + stepCount(step.default ?? [])
      )
    }
    return count + 1 + stepCount(step.steps)
  }, 0)

const compactParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && text !== allFilterValue) params.set(key, text)
  }
  return params
}

const sortToSearchParam = (sorting: SortingState) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')

const sortFromSearchParam = (sort: string | undefined): SortingState =>
  (sort ?? 'updatedAt:desc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      return { id, desc: direction !== 'asc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)

const WorkflowTags = ({ tags }: { tags: AutomationTag[] }) => (
  <div className='flex flex-wrap gap-1'>
    {tags.length === 0 ? (
      <span className='text-sm text-secondary-foreground'>-</span>
    ) : (
      tags.map(tag => (
        <AutomationTagBadge
          key={tag.name}
          tag={tag}
        />
      ))
    )}
  </div>
)

export function AutomationsTable({
  applications,
  automationsPage,
  gridQuery,
  triggers
}: {
  applications: AndroidApplication[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  triggers: AutomationTrigger[]
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const sorting = useMemo(() => sortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    const currentPageIds = new Set(automationsPage.items.map(automation => automation.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => currentPageIds.has(id))))
  }, [automationsPage.items])

  const appNameById = useMemo(() => new Map(applications.map(app => [app.id, app.name])), [applications])
  const automationAppIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const trigger of triggers) {
      const set = map.get(trigger.automationId) ?? new Set<string>()
      set.add(trigger.targetApplicationId)
      map.set(trigger.automationId, set)
    }
    return map
  }, [triggers])
  const selectedAutomations = automationsPage.items.filter(automation => selectedIds.has(automation.id))
  const activeFilterCount = [gridQuery.tag, gridQuery.targetApplicationId, gridQuery.status, gridQuery.lastRun].filter(
    Boolean
  ).length

  const pushGridParams = (patch: Partial<AutomationsGridQuery>) => {
    const params = compactParams({
      q: patch.q ?? gridQuery.q,
      tag: patch.tag ?? gridQuery.tag,
      targetApplicationId: patch.targetApplicationId ?? gridQuery.targetApplicationId,
      status: patch.status ?? gridQuery.status,
      lastRun: patch.lastRun ?? gridQuery.lastRun,
      sort: patch.sort ?? gridQuery.sort,
      page: patch.page ?? gridQuery.page ?? 1,
      pageSize: patch.pageSize ?? gridQuery.pageSize ?? automationsPage.pageSize
    })
    router.push(`/automations${params.size ? `?${params.toString()}` : ''}`)
  }

  const deleteMany = async (items: Automation[]) => {
    setBusy(true)
    const results = await Promise.allSettled(items.map(item => deleteAutomationAction(item.id)))
    const deletedIds = new Set(
      results
        .map((result, index) => (result.status === 'fulfilled' ? items[index]?.id : null))
        .filter((id): id is string => Boolean(id))
    )
    const failedCount = results.length - deletedIds.size
    setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
    setPendingDelete(null)
    setBulkDeleteOpen(false)
    setBusy(false)
    router.refresh()
    toast(
      failedCount > 0
        ? {
            title: 'Some workflows could not be deleted',
            description: `${failedCount} delete request failed.`,
            variant: 'destructive'
          }
        : { title: items.length === 1 ? 'Workflow deleted' : 'Selected workflows deleted' }
    )
  }

  const columns = useMemo<ColumnDef<Automation>[]>(
    () => [
      {
        id: 'name',
        accessorFn: automation => automation.name,
        header: 'Workflow',
        size: 320,
        meta: { label: 'Workflow' },
        cell: ({ row }) => {
          const href = `/automations/${row.original.id}`
          return (
            <div className='grid gap-1'>
              <Link
                href={href}
                className='font-medium text-foreground hover:text-primary'
              >
                {row.original.name}
              </Link>
              <span className='line-clamp-1 text-sm text-secondary-foreground'>
                {row.original.description || 'No description'}
              </span>
            </div>
          )
        }
      },
      {
        id: 'tags',
        header: 'Tags',
        size: 176,
        enableSorting: false,
        meta: { label: 'Tags' },
        cell: ({ row }) => <WorkflowTags tags={row.original.tags} />
      },
      {
        id: 'apps',
        header: 'Apps',
        size: 176,
        enableSorting: false,
        meta: { label: 'Apps' },
        cell: ({ row }) => {
          const appIds = Array.from(automationAppIds.get(row.original.id) ?? [])
          return (
            <span className='text-sm text-secondary-foreground'>
              {appIds.length === 0 ? '-' : appIds.map(id => appNameById.get(id) ?? id).join(', ')}
            </span>
          )
        }
      },
      {
        id: 'steps',
        header: 'Steps',
        size: 112,
        enableSorting: false,
        meta: { label: 'Steps' },
        cell: ({ row }) => {
          const count = stepCount(row.original.definition.spec.steps)
          return (
            <span className='text-sm text-secondary-foreground'>
              {count} {count === 1 ? 'step' : 'steps'}
            </span>
          )
        }
      },
      {
        id: 'lastRunAt',
        accessorFn: automation => automation.lastRunAt ?? '',
        header: 'Last run',
        size: 176,
        meta: { label: 'Last run' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{formatDate(row.original.lastRunAt)}</span>
        )
      },
      {
        id: 'lastStatus',
        accessorFn: automation => automation.lastStatus,
        header: 'Status',
        size: 128,
        meta: { label: 'Status' },
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.lastStatus)}>{statusLabel(row.original.lastStatus)}</Badge>
        )
      }
    ],
    [appNameById, automationAppIds]
  )

  return (
    <div className='grid gap-4'>
      <DataGridToolbar
        search={search}
        searchPlaceholder='Search workflows'
        onSearchChange={setSearch}
        onSearchSubmit={() => pushGridParams({ q: search.trim() || undefined, page: 1 })}
        activeFilterCount={activeFilterCount}
        selectedCount={selectedAutomations.length}
        actions={
          <Button
            size='sm'
            variant='destructive'
            disabled={busy || selectedAutomations.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <IconTrash className='size-4' />
            Delete
          </Button>
        }
        filters={
          <>
            <Select
              value={gridQuery.tag ?? allFilterValue}
              onValueChange={value => pushGridParams({ tag: value === allFilterValue ? undefined : value, page: 1 })}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Tag' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>All tags</SelectItem>
                {automationsPage.facets.tags.map(tag => (
                  <SelectItem
                    key={tag}
                    value={tag}
                  >
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={gridQuery.targetApplicationId ?? allFilterValue}
              onValueChange={value =>
                pushGridParams({ targetApplicationId: value === allFilterValue ? undefined : value, page: 1 })
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='App' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>All apps</SelectItem>
                {applications.map(app => (
                  <SelectItem
                    key={app.id}
                    value={app.id}
                  >
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={gridQuery.status ?? allFilterValue}
              onValueChange={value =>
                pushGridParams({
                  status: value === allFilterValue ? undefined : (value as AutomationsGridQuery['status']),
                  page: 1
                })
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>All status</SelectItem>
                <SelectItem value='never_run'>Never run</SelectItem>
                <SelectItem value='running'>Running</SelectItem>
                <SelectItem value='success'>Success</SelectItem>
                <SelectItem value='failed'>Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={gridQuery.lastRun ?? allFilterValue}
              onValueChange={value =>
                pushGridParams({
                  lastRun: value === allFilterValue ? undefined : (value as AutomationsGridQuery['lastRun']),
                  page: 1
                })
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Last run' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>Any run</SelectItem>
                <SelectItem value='never'>Never run</SelectItem>
                <SelectItem value='7d'>Last 7 days</SelectItem>
                <SelectItem value='30d'>Last 30 days</SelectItem>
                <SelectItem value='90d'>Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <DataGrid
        columns={columns}
        data={automationsPage.items}
        totalItems={automationsPage.total}
        pageIndex={automationsPage.page - 1}
        pageSize={automationsPage.pageSize}
        getRowId={automation => automation.id}
        sorting={sorting}
        onSortingChange={updater => {
          const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
          pushGridParams({ sort: sortToSearchParam(nextSorting), page: 1 })
        }}
        selection={{
          selectedIds,
          onSelectedIdsChange: setSelectedIds
        }}
        minWidth='72rem'
        emptyState={
          <div className='text-center text-secondary-foreground'>No workflows match the current filters.</div>
        }
        mobileCard={row => {
          const automation = row.original
          const count = stepCount(automation.definition.spec.steps)
          const appIds = Array.from(automationAppIds.get(automation.id) ?? [])
          return (
            <div
              key={automation.id}
              className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4'
            >
              <div className='flex items-start gap-3'>
                <Checkbox
                  checked={selectedIds.has(automation.id)}
                  aria-label={`Select ${automation.name}`}
                  onCheckedChange={checked => {
                    const next = new Set(selectedIds)
                    if (checked === true) next.add(automation.id)
                    else next.delete(automation.id)
                    setSelectedIds(next)
                  }}
                />
                <div className='min-w-0 flex-1'>
                  <Link
                    href={`/automations/${automation.id}`}
                    className='font-medium text-foreground hover:text-primary'
                  >
                    {automation.name}
                  </Link>
                  <p className='mt-1 line-clamp-2 text-sm text-secondary-foreground'>
                    {automation.description || 'No description'}
                  </p>
                </div>
                <Badge variant={statusVariant(automation.lastStatus)}>{statusLabel(automation.lastStatus)}</Badge>
              </div>
              <WorkflowTags tags={automation.tags} />
              <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                <div>
                  <dt className='text-secondary-foreground'>Apps</dt>
                  <dd>{appIds.length === 0 ? '-' : appIds.map(id => appNameById.get(id) ?? id).join(', ')}</dd>
                </div>
                <div>
                  <dt className='text-secondary-foreground'>Steps</dt>
                  <dd>
                    {count} {count === 1 ? 'step' : 'steps'}
                  </dd>
                </div>
                <div className='col-span-2'>
                  <dt className='text-secondary-foreground'>Last run</dt>
                  <dd>{formatDate(automation.lastRunAt)}</dd>
                </div>
              </dl>
            </div>
          )
        }}
        rowContextMenu={row => {
          const hasBulkSelection = selectedIds.has(row.original.id) && selectedAutomations.length > 1
          return (
            <>
              {hasBulkSelection ? (
                <ContextMenuItem
                  className='text-destructive focus:text-destructive'
                  disabled={busy}
                  onSelect={() => setBulkDeleteOpen(true)}
                >
                  <IconTrash className='mr-2 size-4' />
                  Delete selected ({selectedAutomations.length})
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem onSelect={() => router.push(`/automations/${row.original.id}/traces`)}>
                <IconActivityHeartbeat className='mr-2 size-4' />
                Traces
              </ContextMenuItem>
              <ContextMenuItem
                className='text-destructive focus:text-destructive'
                onSelect={() => setPendingDelete(row.original)}
              >
                <IconTrash className='mr-2 size-4' />
                Delete
              </ContextMenuItem>
            </>
          )
        }}
      />
      <DataGridPagination
        totalItems={automationsPage.total}
        pageIndex={automationsPage.page - 1}
        pageSize={automationsPage.pageSize}
        onPageIndexChange={pageIndex => pushGridParams({ page: pageIndex + 1 })}
        onPageSizeChange={pageSize => pushGridParams({ page: 1, pageSize })}
      />

      <AutomationDeleteDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'workflow'}?`}
        description='This removes the workflow and its triggers.'
        busy={busy}
        onOpenChange={open => !open && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteMany([pendingDelete])
        }}
      />
      <AutomationDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedAutomations.length} selected workflows?`}
        description='This removes the selected workflows and their triggers.'
        busy={busy}
        onOpenChange={open => !open && setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteMany(selectedAutomations)
        }}
      />
    </div>
  )
}
