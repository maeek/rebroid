'use client'

import { createContext, useContext } from 'react'
import { IconArrowDown, IconArrowUp, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DataGrid, type DataGridProps } from '@/shared/ui/data-grid/data-grid'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { UserGroup } from '@/shared/contracts/auth-user'
import type { CellContext, ColumnDef } from '@tanstack/react-table'

export type Membership = { id: string; group?: UserGroup; priority: number }
type MembershipActions = {
  disabled: boolean
  membershipCount: number
  onMove: (id: string, offset: number) => void
  onRemove: (id: string) => void
}
const MembershipContext = createContext<MembershipActions | null>(null)
const MembershipIdentityCell = ({ row }: CellContext<Membership, unknown>) => (
  <div className='grid gap-1'>
    {row.original.group ? (
      <ResourceLink href={`/security/groups/${row.original.id}`}>{row.original.group.name}</ResourceLink>
    ) : (
      <span>{row.original.id}</span>
    )}
    {row.original.group?.description ? (
      <span className='break-words text-xs leading-5 text-foreground-muted'>{row.original.group.description}</span>
    ) : null}
  </div>
)
const MembershipActionsCell = ({ row }: CellContext<Membership, unknown>) => {
  const context = useContext(MembershipContext)
  if (!context) throw new Error('Membership cells require a membership context.')
  const { disabled, membershipCount, onMove, onRemove } = context
  const { id, group, priority } = row.original
  const name = group?.name ?? id
  return (
    <div className='flex items-center gap-1'>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={`Move ${name} earlier`}
        disabled={disabled || priority === 1}
        onClick={() => onMove(id, -1)}
      >
        <IconArrowUp />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={`Move ${name} later`}
        disabled={disabled || priority === membershipCount}
        onClick={() => onMove(id, 1)}
      >
        <IconArrowDown />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={`Remove ${name}`}
        disabled={disabled}
        onClick={() => onRemove(id)}
      >
        <IconX />
      </Button>
    </div>
  )
}
const columns: ColumnDef<Membership>[] = [
  {
    id: 'group',
    header: 'Group',
    size: 440,
    minSize: 240,
    enableSorting: false,
    enableHiding: false,
    meta: { skeleton: { kind: 'stacked' } },
    cell: MembershipIdentityCell
  },
  {
    id: 'priority',
    header: 'Priority',
    size: 96,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <span className='tabular-nums text-foreground-muted'>{row.original.priority}</span>
  },
  {
    id: 'actions',
    header: 'Membership actions',
    size: 180,
    minSize: 180,
    enableResizing: false,
    enableSorting: false,
    enableHiding: false,
    meta: { skeleton: { kind: 'text' } },
    cell: MembershipActionsCell
  }
]
export const GroupMembershipGrid = ({
  disabled,
  membershipCount,
  onMove,
  onRemove,
  ...props
}: Omit<DataGridProps<Membership>, 'columns'> & MembershipActions) => (
  <MembershipContext.Provider value={{ disabled, membershipCount, onMove, onRemove }}>
    <DataGrid
      {...props}
      columns={columns}
    />
  </MembershipContext.Provider>
)
