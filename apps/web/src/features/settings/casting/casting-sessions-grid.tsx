import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
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
    cell: ({ row }) => <span className='truncate text-sm text-foreground-muted'>{row.original.id}</span>
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
      <span className='text-sm text-foreground-muted'>{formatTimestamp(row.original.lastActivityAt)}</span>
    )
  },
  {
    id: 'expiresAt',
    accessorFn: session => session.expiresAt,
    header: 'Expires',
    size: 192,
    meta: { label: 'Expires' },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{formatTimestamp(row.original.expiresAt)}</span>
  }
]

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
          className='block truncate text-xs text-foreground-muted hover:text-primary'
          href={`/security/users/${ownerId}`}
        >
          {ownerNames.get(ownerId) ?? ownerId}
        </Link>
      ) : (
        <span className='text-xs text-foreground-muted'>Unknown user</span>
      )}
    </div>
  )
}

const CastingSessionStatusBadge = ({ status }: { status: DisplaySidecarSession['status'] }) => (
  <StatusBadge
    className='capitalize'
    tone={status === 'active' ? 'success' : 'neutral'}
  >
    {status}
  </StatusBadge>
)
