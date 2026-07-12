'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataGrid, DataGridWorkspace } from '@/shared/ui/data-grid'
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
  <Link href={`/security/users/${user.id}`}>
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
        <div className='truncate text-xs text-foreground-muted'>{user.username}</div>
      </div>
    </div>
  </Link>
)

const GroupBadges = ({ user, groups }: { user: PublicUser; groups: UserGroup[] }) => (
  <div className='flex flex-wrap gap-1.5'>
    {user.groupIds.map(groupId => (
      <Link
        href={`/security/groups/${groupId}`}
        key={groupId}
      >
        <Badge
          variant='neutral'
          className='max-w-full truncate'
        >
          {groupLabel(groups, groupId)}
        </Badge>
      </Link>
    ))}
  </div>
)

const UserStatus = ({
  user,
  busy,
  onToggleDisabled
}: {
  user: PublicUser
  busy: boolean
  onToggleDisabled: (user: PublicUser) => void
}) => (
  <div className='flex flex-wrap items-center gap-2'>
    <Button
      type='button'
      variant='link'
      disabled={busy}
      className={user.disabled ? 'h-auto px-0 text-danger' : 'h-auto px-0 text-primary'}
      onClick={() => onToggleDisabled(user)}
    >
      {user.disabled ? 'Disabled' : 'Active'}
    </Button>
    {user.passwordChangeRequired ? <Badge variant='warning'>Password change</Badge> : null}
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
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mfaFilter, setMfaFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter(user => {
      if (query && !`${user.name} ${user.username}`.toLowerCase().includes(query)) return false
      if (roleFilter !== 'all' && user.role !== roleFilter) return false
      if (statusFilter === 'active' && user.disabled) return false
      if (statusFilter === 'disabled' && !user.disabled) return false
      if (mfaFilter === 'enabled' && !user.mfaEnabled) return false
      if (mfaFilter === 'disabled' && user.mfaEnabled) return false
      return true
    })
  }, [mfaFilter, roleFilter, search, statusFilter, users])
  const sortedUsers = useMemo(() => sortUsers(filteredUsers, groups, sorting), [filteredUsers, groups, sorting])
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
        meta: { label: 'User', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => <UserIdentity user={row.original} />
      },
      {
        id: 'role',
        accessorFn: user => user.role,
        header: 'Role',
        size: 144,
        meta: { label: 'Role', skeleton: { kind: 'text', width: 'w-24' } },
        cell: ({ row }) => <span className='capitalize text-sm text-foreground-muted'>{row.original.role}</span>
      },
      {
        id: 'groups',
        accessorFn: user => user.groupIds.map(groupId => groupLabel(groups, groupId)).join(', '),
        header: 'Group',
        size: 288,
        meta: { label: 'Group', skeleton: { kind: 'text', width: 'w-36' } },
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
        size: 220,
        meta: { label: 'Status', skeleton: { kind: 'badge' } },
        cell: ({ row }) => (
          <UserStatus
            user={row.original}
            busy={busyUserId === row.original.id}
            onToggleDisabled={onToggleDisabled}
          />
        )
      }
    ],
    [busyUserId, groups, onToggleDisabled]
  )

  return (
    <div className='grid gap-3'>
      <DataGridWorkspace
        search={searchDraft}
        searchPlaceholder='Search users'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        filters={
          <>
            <FormField
              label='Role'
              layout='vertical'
            >
              <Select
                value={roleFilter}
                onValueChange={setRoleFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any role</SelectItem>
                  <SelectItem value='admin'>Admin</SelectItem>
                  <SelectItem value='user'>User</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label='Status'
              layout='vertical'
            >
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='disabled'>Disabled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label='MFA'
              layout='vertical'
            >
              <Select
                value={mfaFilter}
                onValueChange={setMfaFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any MFA state</SelectItem>
                  <SelectItem value='enabled'>Enabled</SelectItem>
                  <SelectItem value='disabled'>Disabled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </>
        }
        activeFilters={[
          ...(roleFilter !== 'all'
            ? [{ id: 'role', label: 'Role', value: roleFilter, onRemove: () => setRoleFilter('all') }]
            : []),
          ...(statusFilter !== 'all'
            ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('all') }]
            : []),
          ...(mfaFilter !== 'all'
            ? [{ id: 'mfa', label: 'MFA', value: mfaFilter, onRemove: () => setMfaFilter('all') }]
            : [])
        ]}
        onResetFilters={() => {
          setRoleFilter('all')
          setStatusFilter('all')
          setMfaFilter('all')
        }}
        selectedCount={selectedUsers.length}
        bulkActions={
          <>
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
              variant='danger'
              disabled={busyUserId !== null}
              onClick={() => onDeleteSelected(selectedUsers)}
            >
              <IconTrash className='size-4' />
              Delete selected
            </Button>
          </>
        }
      >
        <DataGrid
          columns={columns}
          data={sortedUsers}
          totalItems={sortedUsers.length}
          pageIndex={0}
          pageSize={Math.max(sortedUsers.length, 1)}
          getRowId={user => user.id}
          sorting={sorting}
          onSortingChange={updater =>
            setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
          }
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
                      className='text-danger focus:text-danger'
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
                  className='text-danger focus:text-danger'
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
      </DataGridWorkspace>
    </div>
  )
}
