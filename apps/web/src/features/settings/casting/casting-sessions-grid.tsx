import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestamp } from './casting-sidecar-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { DisplaySidecarSession } from '@/server/orchestrator/diagnostics/types'
import type { ColumnDef } from '@tanstack/react-table'

type CastingApp = Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>

export const createCastingSessionColumns = ({
  appsById,
  ownerNames
}: {
  appsById: Map<string, CastingApp>
  ownerNames: Map<string, string>
}): ColumnDef<DisplaySidecarSession>[] => [
  {
    id: 'application',
    accessorFn: session => session.applicationId ?? '',
    header: 'Application and user',
    size: 352,
    meta: { label: 'Application and user' },
    cell: ({ row }) => (
      <CastingSessionIdentity
        session={row.original}
        appsById={appsById}
        ownerNames={ownerNames}
      />
    )
  },
  {
    id: 'id',
    accessorFn: session => session.id,
    header: 'Session ID',
    size: 224,
    meta: { label: 'Session ID' },
    cell: ({ row }) => <span className='truncate text-sm text-secondary-foreground'>{row.original.id}</span>
  },
  {
    id: 'status',
    accessorFn: session => session.status,
    header: 'Status',
    size: 112,
    meta: { label: 'Status' },
    cell: ({ row }) => <CastingSessionStatusBadge status={row.original.status} />
  },
  {
    id: 'lastActivityAt',
    accessorFn: session => session.lastActivityAt,
    header: 'Last activity',
    size: 192,
    meta: { label: 'Last activity' },
    cell: ({ row }) => (
      <span className='text-sm text-secondary-foreground'>{formatTimestamp(row.original.lastActivityAt)}</span>
    )
  },
  {
    id: 'expiresAt',
    accessorFn: session => session.expiresAt,
    header: 'Expires',
    size: 192,
    meta: { label: 'Expires' },
    cell: ({ row }) => (
      <span className='text-sm text-secondary-foreground'>{formatTimestamp(row.original.expiresAt)}</span>
    )
  }
]

export const CastingSessionMobileCard = ({
  session,
  appsById,
  ownerNames,
  selected,
  onSelectedChange
}: {
  session: DisplaySidecarSession
  appsById: Map<string, CastingApp>
  ownerNames: Map<string, string>
  selected: boolean
  onSelectedChange: (selected: boolean) => void
}) => (
  <div className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4'>
    <div className='flex items-start gap-3'>
      <Checkbox
        checked={selected}
        aria-label='Select session'
        onCheckedChange={checked => onSelectedChange(checked === true)}
      />
      <CastingSessionIdentity
        session={session}
        appsById={appsById}
        ownerNames={ownerNames}
        className='min-w-0 flex-1'
      />
    </div>
    <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
      <div>
        <dt className='text-secondary-foreground'>Status</dt>
        <dd>
          <CastingSessionStatusBadge status={session.status} />
        </dd>
      </div>
      <div>
        <dt className='text-secondary-foreground'>Session ID</dt>
        <dd className='truncate'>{session.id}</dd>
      </div>
      <div>
        <dt className='text-secondary-foreground'>Last activity</dt>
        <dd>{formatTimestamp(session.lastActivityAt)}</dd>
      </div>
      <div>
        <dt className='text-secondary-foreground'>Expires</dt>
        <dd>{formatTimestamp(session.expiresAt)}</dd>
      </div>
    </dl>
  </div>
)

const CastingSessionIdentity = ({
  session,
  appsById,
  ownerNames,
  className
}: {
  session: DisplaySidecarSession
  appsById: Map<string, CastingApp>
  ownerNames: Map<string, string>
  className?: string
}) => {
  const app = session.applicationId ? appsById.get(session.applicationId) : undefined
  const ownerId = session.ownerUserId ?? app?.ownerUserId

  return (
    <div className={className ?? 'flex min-w-0 flex-col gap-1'}>
      {session.applicationId ? (
        <Link
          className='block truncate font-medium hover:text-primary'
          href={`/app/${session.applicationId}/manage`}
        >
          {app?.name ?? session.applicationId}
        </Link>
      ) : (
        <span>Unassigned application</span>
      )}
      {ownerId ? (
        <Link
          className='block truncate text-xs text-muted-foreground hover:text-primary'
          href={`/users/${ownerId}`}
        >
          {ownerNames.get(ownerId) ?? ownerId}
        </Link>
      ) : (
        <span className='text-xs text-muted-foreground'>Unknown user</span>
      )}
    </div>
  )
}

const CastingSessionStatusBadge = ({ status }: { status: DisplaySidecarSession['status'] }) => (
  <Badge
    className='capitalize'
    variant={status === 'active' ? 'status' : 'secondary'}
  >
    {status}
  </Badge>
)
