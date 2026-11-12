'use client'

import { useMemo, useState } from 'react'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { ActiveWorkflowRun } from '@/shared/contracts/active-workflow-run'
import type { ColumnDef } from '@tanstack/react-table'

export const ActiveWorkflowRunsGrid = ({
  runs,
  targets,
  loading
}: {
  runs: ActiveWorkflowRun[]
  targets: Record<string, string>
  loading: boolean
}) => {
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const columns = useMemo<ColumnDef<ActiveWorkflowRun>[]>(
    () => [
      {
        id: 'workflow',
        header: 'Workflow run',
        size: 260,
        meta: { skeleton: { kind: 'stacked' } },
        cell: ({ row: { original: run } }) => (
          <div className='grid justify-items-start gap-1'>
            <ResourceLink href={workflowTraceHref(run.automationId, run.id)}>{run.workflowName}</ResourceLink>
            <span className='text-xs text-foreground-muted'>Run {run.id.slice(0, 8)}</span>
          </div>
        )
      },
      {
        id: 'target',
        header: 'Target app',
        size: 200,
        meta: { skeleton: { kind: 'text' } },
        cell: ({ row: { original: run } }) => (
          <ResourceLink href={`/app/${encodeURIComponent(run.targetApplicationId)}`}>
            {targets[run.targetApplicationId] ?? 'Open app'}
          </ResourceLink>
        )
      },
      {
        id: 'status',
        header: 'Status',
        size: 136,
        meta: { skeleton: { kind: 'badge' } },
        cell: ({ row }) => <AutomationRunStatusBadge status={row.original.status} />
      },
      {
        id: 'createdAt',
        header: 'Queued at',
        size: 176,
        meta: { skeleton: { kind: 'text' } },
        cell: ({ row }) => (
          <DateTimeValue
            value={row.original.createdAt}
            compact
          />
        )
      }
    ],
    [targets]
  )
  const query = appliedSearch.trim().toLowerCase()
  const matches = runs.filter(run =>
    [run.workflowName, run.id, targets[run.targetApplicationId] ?? run.targetApplicationId].some(value =>
      value.toLowerCase().includes(query)
    )
  )
  const currentPage = Math.min(pageIndex, Math.max(0, Math.ceil(matches.length / pageSize) - 1))

  return (
    <DataGridWorkspace
      search={search}
      appliedSearch={appliedSearch}
      searchPlaceholder='Search active runs'
      onSearchChange={setSearch}
      onSearch={value => {
        setAppliedSearch(value)
        setPageIndex(0)
      }}
      disabled={loading}
    >
      <DataGrid
        columns={columns}
        data={matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
        totalItems={matches.length}
        pageIndex={currentPage}
        pageSize={pageSize}
        getRowId={run => run.id}
        minWidth='44rem'
        loading={loading}
        emptyState={
          <DataGridEmptyState
            title='No active workflow runs'
            description='Queued and running workflows appear here.'
          />
        }
      />
      <DataGridPagination
        pageIndex={currentPage}
        pageSize={pageSize}
        totalItems={matches.length}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={size => {
          setPageSize(size)
          setPageIndex(0)
        }}
        loading={loading}
      />
    </DataGridWorkspace>
  )
}
