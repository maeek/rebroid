'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DataGrid } from '@/shared/ui/data-grid'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'
import type { PublicUser, UserGroup } from '@/server/auth/user'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const groupLabel = (groups: UserGroup[], groupId: string) => groups.find(group => group.id === groupId)?.name ?? groupId

const sortUsers = (users: PublicUser[], groups: UserGroup[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'name', desc: false }]
  return [...users].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') result = left.name.localeCompare(right.name)
      else if (item.id === 'role') result = left.role.localeCompare(right.role)
      else if (item.id === 'groups') {
        result = left.groupIds
          .map(id => groupLabel(groups, id))
          .join(', ')
          .localeCompare(right.groupIds.map(id => groupLabel(groups, id)).join(', '))
      } else if (item.id === 'status') {
        result = Number(left.disabled) - Number(right.disabled)
      }
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

const UserIdentity = ({ user }: { user: PublicUser }) => (
  <Link href={`/users/${user.id}`}>
    <div className='flex min-w-0 items-center gap-3'>
      <Avatar className='size-9'>
        <AvatarImage src={user.avatarDataUrl ?? ''} />
        <AvatarFallback
          style={{
            backgroundColor: getHslColorFromCharCode(user.name),
            color: getHslColorFromCharCodeForeground(user.name)
          }}
        >
          {user.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className='min-w-0'>
        <div className='truncate font-medium hover:underline hover:text-primary focus:underline'>{user.name}</div>
        <div className='truncate text-xs text-muted-foreground'>{user.username}</div>
      </div>
    </div>
  </Link>
)

const GroupBadges = ({ user, groups }: { user: PublicUser; groups: UserGroup[] }) => (
  <div className='flex flex-wrap gap-1.5'>
    {user.groupIds.map(groupId => (
      <Link
        href={`/users/groups/${groupId}`}
        key={groupId}
      >
        <Badge
          variant='secondary'
          className='max-w-full truncate'
        >
          {groupLabel(groups, groupId)}
        </Badge>
      </Link>
    ))}
  </div>
)

export const UsersGrid = ({
  users,
  groups,
  busyUserId,
  onToggleDisabled,
  onDelete,
  onDeleteSelected,
  onDisableSelected,
  onEnableSelected
}: {
  users: PublicUser[]
  groups: UserGroup[]
  busyUserId: string | null
  onToggleDisabled: (user: PublicUser) => void
  onDelete: (user: PublicUser) => void
  onDeleteSelected: (users: PublicUser[]) => void
  onDisableSelected: (users: PublicUser[]) => void
  onEnableSelected: (users: PublicUser[]) => void
}) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const sortedUsers = useMemo(() => sortUsers(users, groups, sorting), [groups, sorting, users])
  const selectedUsers = sortedUsers.filter(user => selectedIds.has(user.id))

  useEffect(() => {
    const userIds = new Set(users.map(user => user.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => userIds.has(id))))
  }, [users])

  const columns = useMemo<ColumnDef<PublicUser>[]>(
    () => [
      {
        id: 'name',
        accessorFn: user => user.name,
        header: 'User',
        size: 320,
        meta: { label: 'User' },
        cell: ({ row }) => <UserIdentity user={row.original} />
      },
      {
        id: 'role',
        accessorFn: user => user.role,
        header: 'Role',
        size: 144,
        meta: { label: 'Role' },
        cell: ({ row }) => <span className='capitalize text-sm text-foreground-muted'>{row.original.role}</span>
      },
      {
        id: 'groups',
        accessorFn: user => user.groupIds.map(groupId => groupLabel(groups, groupId)).join(', '),
        header: 'Group',
        size: 288,
        meta: { label: 'Group' },
        cell: ({ row }) => (
          <GroupBadges
            user={row.original}
            groups={groups}
          />
        )
      },
      {
        id: 'status',
        accessorFn: user => user.disabled,
        header: 'Status',
        size: 128,
        meta: { label: 'Status' },
        cell: ({ row }) => (
          <Button
            type='button'
            variant='link'
            disabled={busyUserId === row.original.id}
            className={row.original.disabled ? 'px-0 text-destructive' : 'px-0 text-primary'}
            onClick={() => onToggleDisabled(row.original)}
          >
            {row.original.disabled ? 'Disabled' : 'Active'}
          </Button>
        )
      }
    ],
    [busyUserId, groups, onToggleDisabled]
  )

  return (
    <div className='grid gap-3'>
      {selectedUsers.length > 0 ? (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-panel/50 px-4 py-3 text-sm'>
          <span className='text-foreground-muted'>{selectedUsers.length} selected</span>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='secondary'
              disabled={busyUserId !== null}
              onClick={() => onEnableSelected(selectedUsers)}
            >
              Enable selected
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={busyUserId !== null}
              onClick={() => onDisableSelected(selectedUsers)}
            >
              Disable selected
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={busyUserId !== null}
              onClick={() => onDeleteSelected(selectedUsers)}
            >
              <IconTrash className='size-4' />
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}
      <DataGrid
        columns={columns}
        data={sortedUsers}
        totalItems={sortedUsers.length}
        pageIndex={0}
        pageSize={Math.max(sortedUsers.length, 1)}
        getRowId={user => user.id}
        sorting={sorting}
        onSortingChange={updater => setSorting(current => (typeof updater === 'function' ? updater(current) : updater))}
        selection={{
          selectedIds,
          onSelectedIdsChange: setSelectedIds
        }}
        minWidth='64rem'
        emptyState={<div className='text-center text-foreground-muted'>No users have been created.</div>}
        rowContextMenu={row => {
          const hasBulkSelection = selectedIds.has(row.original.id) && selectedUsers.length > 1
          return (
            <>
              {hasBulkSelection ? (
                <>
                  <ContextMenuItem
                    disabled={busyUserId !== null}
                    onSelect={() => onEnableSelected(selectedUsers)}
                  >
                    Enable selected ({selectedUsers.length})
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={busyUserId !== null}
                    onSelect={() => onDisableSelected(selectedUsers)}
                  >
                    Disable selected ({selectedUsers.length})
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-destructive focus:text-destructive'
                    disabled={busyUserId !== null}
                    onSelect={() => onDeleteSelected(selectedUsers)}
                  >
                    <IconTrash className='mr-2 size-4' />
                    Delete selected ({selectedUsers.length})
                  </ContextMenuItem>
                </>
              ) : null}
              <ContextMenuItem
                disabled={busyUserId === row.original.id}
                onSelect={() => onToggleDisabled(row.original)}
              >
                {row.original.disabled ? 'Enable' : 'Disable'}
              </ContextMenuItem>
              <ContextMenuItem
                className='text-destructive focus:text-destructive'
                disabled={busyUserId === row.original.id}
                onSelect={() => onDelete(row.original)}
              >
                <IconTrash className='mr-2 size-4' />
                Delete
              </ContextMenuItem>
            </>
          )
        }}
      />
    </div>
  )
}
