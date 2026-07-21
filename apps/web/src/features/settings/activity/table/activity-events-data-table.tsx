import { useMemo } from 'react'
import { IconEye, IconSearch, IconShieldCheck } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { useActivityController, useActivityData } from '../activity-context'
import { formatAction, outcomeTone } from '../activity-format'
import { ActivityResourceTypeBadge } from '../common/activity-resource-type-badge'
import type { AuditEvent } from '@/shared/contracts/audit'
import type { ColumnDef } from '@tanstack/react-table'

const ActivityEventBadges = ({ event }: { event: AuditEvent }) => (
  <div className='mt-1 flex flex-wrap gap-1'>
    <Badge variant='outline'>{event.category}</Badge>
    <ActivityResourceTypeBadge resourceType={event.resourceType} />
  </div>
)

const ActivityEventTargetCell = ({ event }: { event: AuditEvent }) => (
  <div>
    <div className='truncate font-medium'>{event.resourceLabel ?? event.resourceId ?? 'none'}</div>
    <div className='mt-1 truncate font-mono text-xs text-foreground-muted'>
      {event.resourceId ?? event.resourceType ?? 'No resource id'}
    </div>
  </div>
)

const ActivityEventsEmptyState = ({ resetFilters }: { resetFilters: () => void }) => (
  <div className='mx-auto flex max-w-md flex-col items-center text-center'>
    <div className='mb-3 rounded-full border border-surface-border/70 bg-surface-panel/70 p-3'>
      <IconSearch className='size-6 text-foreground-muted' />
    </div>
    <div className='font-medium'>No activity found</div>
    <p className='mt-1 text-sm text-foreground-muted'>
      Try clearing filters or widening the date range. New audit events appear here after actions finish.
    </p>
    <Button
      className='mt-4'
      variant='secondary'
      onClick={resetFilters}
    >
      Clear filters
    </Button>
  </div>
)

export const ActivityEventsDataTable = () => {
  const { result, sorting } = useActivityData()
  const controller = useActivityController()
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: 'action',
        accessorFn: event => event.action,
        header: 'Event',
        size: 256,
        meta: { label: 'Event' },
        cell: ({ row }) => (
          <div className='flex items-start gap-3'>
            <div className='mt-0.5 rounded-panel border border-surface-border/60 bg-surface-band/50 p-2'>
              <IconShieldCheck className='size-4 text-foreground-muted' />
            </div>
            <div className='min-w-0'>
              <div className='font-medium'>{formatAction(row.original.action)}</div>
              <ActivityEventBadges event={row.original} />
            </div>
          </div>
        )
      },
      {
        id: 'actorLabel',
        accessorFn: event => event.actorLabel,
        header: 'Actor',
        size: 176,
        meta: { label: 'Actor' },
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.actorLabel}</div>
            <div className='mt-1 font-mono text-xs text-foreground-muted'>{row.original.actorUserId ?? 'system'}</div>
          </div>
        )
      },
      {
        id: 'resourceLabel',
        accessorFn: event => event.resourceLabel ?? event.resourceId ?? event.resourceType ?? '',
        header: 'Target',
        size: 240,
        meta: { label: 'Target' },
        cell: ({ row }) => <ActivityEventTargetCell event={row.original} />
      },
      {
        id: 'outcome',
        accessorFn: event => event.outcome,
        header: 'Outcome',
        size: 160,
        meta: { label: 'Outcome' },
        cell: ({ row }) => <Badge variant={outcomeTone(row.original.outcome)}>{row.original.outcome}</Badge>
      },
      {
        id: 'createdAt',
        accessorFn: event => event.createdAt,
        header: 'Time',
        size: 224,
        meta: { label: 'Time' },
        cell: ({ row }) => (
          <div>
            <div>{new Date(row.original.createdAt).toLocaleString()}</div>
            <div className='mt-1 text-xs text-foreground-muted'>{row.original.createdAt}</div>
          </div>
        )
      }
    ],
    []
  )

  return (
    <DataGrid
      columns={columns}
      data={result.events}
      totalItems={result.total}
      pageIndex={result.page - 1}
      pageSize={result.pageSize}
      getRowId={event => String(event.id)}
      sorting={sorting}
      onSortingChange={updater => {
        const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
        controller.setSorting(nextSorting)
      }}
      minWidth='78rem'
      emptyState={<ActivityEventsEmptyState resetFilters={controller.resetFilters} />}
      rowContextMenu={row => (
        <ContextMenuItem onSelect={() => controller.setSelectedEvent(row.original)}>
          <IconEye className='mr-2 size-4' />
          Details
        </ContextMenuItem>
      )}
    />
  )
}
