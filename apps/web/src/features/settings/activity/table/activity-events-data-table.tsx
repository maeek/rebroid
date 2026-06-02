import { IconEye, IconSearch, IconShieldCheck } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActivityController, useActivityData } from '../activity-context'
import { formatAction, outcomeTone } from '../activity-format'
import { ActivityResourceTypeBadge } from '../common/activity-resource-type-badge'
import type { AuditEvent } from '@/server/storage/database'

const ActivityEventBadges = ({ event }: { event: AuditEvent }) => (
  <div className='mt-1 flex flex-wrap gap-1'>
    <Badge variant='outline'>{event.category}</Badge>
    <ActivityResourceTypeBadge resourceType={event.resourceType} />
  </div>
)

const ActivityEventTargetCell = ({ event }: { event: AuditEvent }) => (
  <TableCell className='px-4 py-4 align-top'>
    <div className='truncate font-medium'>{event.resourceLabel ?? event.resourceId ?? 'none'}</div>
    <div className='mt-1 truncate font-mono text-xs text-secondary-foreground'>
      {event.resourceId ?? event.resourceType ?? 'No resource id'}
    </div>
  </TableCell>
)

const ActivityEventsEmptyState = ({ resetFilters }: { resetFilters: () => void }) => (
  <TableRow>
    <TableCell
      colSpan={6}
      className='px-4 py-10'
    >
      <div className='mx-auto flex max-w-md flex-col items-center text-center'>
        <div className='mb-3 rounded-full border border-border/70 bg-card/60 p-3'>
          <IconSearch className='size-6 text-secondary-foreground' />
        </div>
        <div className='font-medium'>No activity found</div>
        <p className='mt-1 text-sm text-secondary-foreground'>
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
    </TableCell>
  </TableRow>
)

const ActivityEventRow = ({
  event,
  setSelectedEvent
}: {
  event: AuditEvent
  setSelectedEvent: (event: AuditEvent) => void
}) => (
  <TableRow
    key={event.id}
    className='group'
  >
    <TableCell className='px-4 py-4 align-top'>
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 rounded-lg border border-border/60 bg-secondary/50 p-2'>
          <IconShieldCheck className='size-4 text-secondary-foreground' />
        </div>
        <div className='min-w-0'>
          <div className='font-medium'>{formatAction(event.action)}</div>
          <ActivityEventBadges event={event} />
        </div>
      </div>
    </TableCell>
    <TableCell className='px-4 py-4 align-top'>
      <div className='font-medium'>{event.actorLabel}</div>
      <div className='mt-1 font-mono text-xs text-secondary-foreground'>{event.actorUserId ?? 'system'}</div>
    </TableCell>
    <ActivityEventTargetCell event={event} />
    <TableCell className='px-4 py-4 align-top'>
      <Badge variant={outcomeTone(event.outcome)}>{event.outcome}</Badge>
    </TableCell>
    <TableCell className='px-4 py-4 align-top'>
      <div>{new Date(event.createdAt).toLocaleString()}</div>
      <div className='mt-1 text-xs text-secondary-foreground'>{event.createdAt}</div>
    </TableCell>
    <TableCell className='px-4 py-4 text-right align-top'>
      <Button
        variant='secondary'
        size='sm'
        onClick={() => setSelectedEvent(event)}
      >
        <IconEye className='size-4' />
        Details
      </Button>
    </TableCell>
  </TableRow>
)

export const ActivityEventsDataTable = () => {
  const { result } = useActivityData()
  const controller = useActivityController()

  return (
    <div className='overflow-hidden rounded-xl border border-border/70 bg-background/25'>
      <Table
        className='table-fixed'
        style={{ minWidth: '78rem' }}
      >
        <TableHeader className='bg-background/45'>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='w-64 px-4 py-3 uppercase'>Event</TableHead>
            <TableHead className='w-44 px-4 py-3 uppercase'>Actor</TableHead>
            <TableHead className='w-60 px-4 py-3 uppercase'>Target</TableHead>
            <TableHead className='w-40 px-4 py-3 uppercase'>Outcome</TableHead>
            <TableHead className='w-56 px-4 py-3 uppercase'>Time</TableHead>
            <TableHead className='w-28 px-4 py-3 text-right uppercase'>Inspect</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.events.length === 0 ? (
            <ActivityEventsEmptyState resetFilters={controller.resetFilters} />
          ) : (
            result.events.map(event => (
              <ActivityEventRow
                key={event.id}
                event={event}
                setSelectedEvent={controller.setSelectedEvent}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
