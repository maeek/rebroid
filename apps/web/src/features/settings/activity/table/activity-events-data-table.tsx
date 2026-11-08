import { useMemo } from 'react'
import { IconEye } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  auditActionLabel,
  auditActorLabel,
  auditValueLabel,
  auditTargetLabel
} from '@/shared/model/audit-event-presentation'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { useActivityController, useActivityData } from '../activity-context'
import { outcomeTone } from '../activity-format'
import type { AuditEvent } from '@/shared/contracts/audit'
import type { ColumnDef } from '@tanstack/react-table'

export const ActivityEventsDataTable = () => {
  const { result, sorting, loading } = useActivityData()
  const controller = useActivityController()
  const { setSelectedEvent } = controller
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: 'createdAt',
        accessorFn: event => event.createdAt,
        header: 'Time',
        size: 176,
        meta: { label: 'Time', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <DateTimeValue
            value={row.original.createdAt}
            showSeconds
          />
        )
      },
      {
        id: 'action',
        accessorFn: event => event.action,
        header: 'Event',
        size: 264,
        meta: { label: 'Event', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid min-w-0 gap-1'>
            <Button
              variant='bare'
              className='h-auto justify-start whitespace-normal border-0 p-0 text-left text-primary hover:underline'
              aria-label={`Inspect ${auditActionLabel(row.original.action)}`}
              onClick={() => setSelectedEvent(row.original)}
            >
              {auditActionLabel(row.original.action)}
            </Button>
            <span className='text-xs text-foreground-muted'>{auditValueLabel(row.original.category)}</span>
          </div>
        )
      },
      {
        id: 'actorLabel',
        accessorFn: event => event.actorLabel,
        header: 'Actor',
        size: 168,
        meta: { label: 'Actor', skeleton: { kind: 'text' } },
        cell: ({ row }) => <span className='break-words'>{auditActorLabel(row.original)}</span>
      },
      {
        id: 'resourceLabel',
        accessorFn: event => event.resourceLabel ?? event.resourceId ?? event.resourceType ?? '',
        header: 'Target',
        size: 264,
        meta: { label: 'Target', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => {
          const event = row.original
          const target = auditTargetLabel(event)
          const type = event.resourceType ? auditValueLabel(event.resourceType) : null
          return (
            <div className='grid min-w-0 gap-1'>
              <span
                className='truncate'
                title={target}
              >
                {target}
              </span>
              {type && type.toLowerCase() !== target.toLowerCase() ? (
                <span className='text-xs text-foreground-muted'>{type}</span>
              ) : null}
            </div>
          )
        }
      },
      {
        id: 'outcome',
        accessorFn: event => event.outcome,
        header: 'Outcome',
        size: 128,
        meta: { label: 'Outcome', skeleton: { kind: 'badge' } },
        cell: ({ row }) => (
          <Badge variant={outcomeTone(row.original.outcome)}>{auditValueLabel(row.original.outcome)}</Badge>
        )
      }
    ],
    [setSelectedEvent]
  )

  return (
    <DataGrid
      loading={loading}
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
      minWidth='60rem'
      emptyState={
        <DataGridEmptyState
          title='No activity yet'
          description='Recorded events will appear here after actions finish. You can also widen the date range.'
        />
      }
      rowActivation={{
        getLabel: event => `Inspect ${auditActionLabel(event.action)} by ${auditActorLabel(event)}`,
        onActivate: setSelectedEvent
      }}
      rowContextMenu={row => (
        <ContextMenuItem onSelect={() => setSelectedEvent(row.original)}>
          <IconEye className='mr-2 size-4' />
          Details
        </ContextMenuItem>
      )}
    />
  )
}
