'use client'

import { useState, type ReactNode } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { getBff } from '@/lib/http/bff'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { StateView } from '@/shared/ui/state-view'
import { workflowRunDuration, workflowRunIsActive, workflowRunTriggerLabels } from './app-workflow-run-presentation'
import type {
  ApplicationWorkflowRunPage,
  ApplicationWorkflowRunRow
} from '@/shared/contracts/application-workflow-history'
import type { ColumnDef } from '@tanstack/react-table'

const pageSizeOptions = [10, 25, 50]
const initialPageSize = 25

const runColumns = (
  href: (id: string) => string,
  onOpen: (id: string) => void
): ColumnDef<ApplicationWorkflowRunRow>[] => [
  {
    id: 'workflow',
    header: 'Workflow',
    size: 210,
    meta: { label: 'Workflow', skeleton: { kind: 'stacked' } },
    cell: ({ row: { original: run } }) => (
      <div className='grid gap-1'>
        <ResourceLink
          href={href(run.id)}
          data-workflow-run={run.id}
          className='w-fit font-medium'
          onNavigate={event => {
            event.preventDefault()
            onOpen(run.id)
          }}
        >
          {run.automationName ?? 'Deleted workflow'}
        </ResourceLink>
        <span className='text-xs text-foreground-muted'>Run {run.id.slice(0, 8)}</span>
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    size: 100,
    meta: { label: 'Status', skeleton: { kind: 'badge' } },
    cell: ({ row }) => (
      <AutomationRunStatusBadge
        runId={row.original.id}
        status={row.original.status}
      />
    )
  },
  {
    id: 'time',
    header: 'Time',
    size: 148,
    meta: { label: 'Time', skeleton: { kind: 'stacked' } },
    cell: ({ row: { original: run } }) => <DateTimeValue value={run.startedAt ?? run.createdAt} />
  },
  {
    id: 'trigger',
    header: 'Trigger',
    size: 94,
    meta: { label: 'Trigger', skeleton: { kind: 'text', width: 'w-16' } },
    cell: ({ row }) => workflowRunTriggerLabels[row.original.trigger]
  },
  {
    id: 'duration',
    header: 'Duration',
    size: 88,
    meta: { label: 'Duration', skeleton: { kind: 'text', width: 'w-12' } },
    cell: ({ row: { original: run } }) => (
      <span className='tabular-nums'>{workflowRunDuration(run.startedAt, run.completedAt)}</span>
    )
  }
]

export function AppWorkflowRunHistory({
  endpoint,
  enabled = true,
  loading = false,
  launch,
  href,
  onOpen
}: {
  endpoint?: string
  enabled?: boolean
  loading?: boolean
  launch: ReactNode
  href: (id: string) => string
  onOpen: (id: string) => void
}) {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: search })
  const query = useQuery({
    queryKey: ['application-workflow-runs', endpoint, page, pageSize, search],
    queryFn: ({ signal }) => getBff<ApplicationWorkflowRunPage>(`${endpoint}?${params}`, signal),
    enabled: Boolean(endpoint && enabled && !loading),
    refetchInterval: current => {
      const runs = current.state.data?.items
      if (!runs || current.state.error) return false
      return runs.some(run => workflowRunIsActive(run.status)) ? 5000 : 15000
    },
    retry: false
  })
  const pending = loading || query.isLoading
  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const error = query.error

  return (
    <Section
      title='Run history'
      surface='plain'
      actions={launch}
    >
      <DataGridWorkspace
        search={searchDraft}
        appliedSearch={search}
        searchPlaceholder='Search workflows or run IDs'
        onSearchChange={value => setSearchDraft(value.slice(0, 200))}
        onSearch={value => {
          setSearch(value.trim())
          setPage(0)
        }}
        disabled={loading}
        actions={
          <MutationButton
            variant='ghost'
            pending={query.isFetching && !query.isLoading}
            pendingLabel='Refreshing…'
            disabled={loading || query.isLoading}
            onClick={() => void query.refetch()}
          >
            <IconRefresh />
            Refresh
          </MutationButton>
        }
        notice={
          error && query.data ? (
            <Notice
              tone='warning'
              title='Could not refresh workflow runs'
            />
          ) : undefined
        }
      >
        <DataGrid
          columns={runColumns(href, onOpen)}
          data={items}
          getRowId={run => run.id}
          minWidth='36rem'
          loading={pending}
          pageIndex={page}
          pageSize={pageSize}
          totalItems={total}
          emptyState={
            error && !query.data ? (
              <StateView
                scope='grid'
                kind='error'
                title='Could not load workflow runs'
                description={error.message}
              />
            ) : (
              <DataGridEmptyState
                title='No workflow runs yet'
                description='Run a workflow on this app to see it here.'
              />
            )
          }
        />
        {pending || total > 0 || page > 0 ? (
          <DataGridPagination
            loading={pending}
            pageIndex={page}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalItems={total}
            onPageIndexChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setPage(0)
            }}
          />
        ) : null}
      </DataGridWorkspace>
    </Section>
  )
}
