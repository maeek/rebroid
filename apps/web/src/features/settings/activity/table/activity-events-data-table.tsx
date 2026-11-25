import { useMemo } from 'react'
import { IconEye } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
import activityStyles from '../activity-events.module.css'
import { outcomeTone } from '../activity-format'
import type { AuditEvent } from '@/shared/contracts/audit'
import type { ColumnDef } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

const EventOutcome = ({ outcome }: { outcome: AuditEvent['outcome'] }) => (
  <Badge variant={outcomeTone(outcome)}>{auditValueLabel(outcome)}</Badge>
)

export const ActivityEventsDataTable = () => {
  const { result, sorting, loading, application } = useActivityData()
  const scopedToApp = Boolean(application)
  const controller = useActivityController()
  const { setSelectedEvent } = controller
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: 'createdAt',
        accessorFn: event => event.createdAt,
        header: 'Time',
        size: 176,
        enableHiding: false,
        meta: { label: 'Time', compactSlot: 'sort', skeleton: { kind: 'stacked' } },
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
        enableHiding: false,
        meta: {
          label: 'Event',
          compactSlot: 'title',
          skeleton: {
            kind: 'custom',
            render: () => (
              <div className='grid gap-1'>
                <div className={activityStyles.eventHeading}>
                  <div className={cn('flex min-w-0 items-center', styles.settingsTouchTarget)}>
                    <Skeleton className='h-5 w-3/4' />
                  </div>
                  <div className={styles.settingsOnly}>
                    <Skeleton className='h-5 w-16 rounded-full' />
                  </div>
                </div>
                <Skeleton className='h-4 w-2/3' />
              </div>
            )
          }
        },
        cell: ({ row }) => (
          <div className='grid min-w-0 gap-1'>
            <div className={activityStyles.eventHeading}>
              <Button
                variant='bare'
                className={cn(
                  'h-auto min-w-0 justify-start whitespace-normal border-0 p-0 text-left text-primary wrap-anywhere hover:underline focus-visible:ring-inset',
                  styles.settingsTouchTarget
                )}
                aria-label={`Inspect ${auditActionLabel(row.original.action)}`}
                onClick={() => setSelectedEvent(row.original)}
              >
                {auditActionLabel(row.original.action)}
              </Button>
              <div className={styles.settingsOnly}>
                <EventOutcome outcome={row.original.outcome} />
              </div>
            </div>
            <span className={cn('text-xs text-foreground-muted', styles.settingsWideOnly)}>
              {auditValueLabel(row.original.category)}
            </span>
            <div className={styles.settingsOnly}>
              <div className='flex flex-wrap items-baseline gap-x-2 text-xs text-foreground-muted'>
                <span className='wrap-anywhere'>{auditActorLabel(row.original)}</span>
                <DateTimeValue
                  value={row.original.createdAt}
                  compact
                  showSeconds
                />
              </div>
            </div>
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
        meta: { label: 'Target', compactSlot: scopedToApp ? undefined : 'details', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => {
          const event = row.original
          const target = auditTargetLabel(event)
          const type = event.resourceType ? auditValueLabel(event.resourceType) : null
          return (
            <div
              className='grid min-w-0 gap-1'
              data-compact-empty={target === '—' || undefined}
            >
              <span
                className='truncate'
                title={target}
              >
                {target}
              </span>
              {type && type.toLowerCase() !== target.toLowerCase() ? (
                <span className={cn('text-xs text-foreground-muted', styles.settingsWideOnly)}>{type}</span>
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
        cell: ({ row }) => <EventOutcome outcome={row.original.outcome} />
      }
    ],
    [scopedToApp, setSelectedEvent]
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
      emptyState={
        <DataGridEmptyState
          artwork='activity'
          artworkSize={scopedToApp ? 'panel' : 'page'}
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
          <IconEye className='size-4' />
          Details
        </ContextMenuItem>
      )}
    />
  )
}
