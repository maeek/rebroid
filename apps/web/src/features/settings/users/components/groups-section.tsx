'use client'

import { useEffect, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { deleteUserGroupAction } from '@/server/users/actions/delete-user-group-action'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import type { UserGroup } from '@/shared/contracts/auth-user'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

export const GroupsSection = ({
  groups,
  onGroupsDeleted
}: {
  groups: UserGroup[]
  onGroupsDeleted: (groupIds: Set<string>) => void
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingDeleteGroups, setPendingDeleteGroups] = useState<UserGroup[]>([])
  const visibleGroups = groups.filter(group => {
    const query = search.trim().toLowerCase()
    if (query && !`${group.name} ${group.description}`.toLowerCase().includes(query)) return false
    return roleFilter === 'all' || group.role === roleFilter
  })
  const sortedGroups = [...visibleGroups].sort((left, right) => {
    const activeSorting = sorting.length > 0 ? sorting : [{ id: 'name', desc: false }]
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      const result = item.id === 'role' ? left.role.localeCompare(right.role) : left.name.localeCompare(right.name)
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
  const selectedGroups = sortedGroups.filter(group => selectedIds.has(group.id))

  useEffect(() => {
    const groupIds = new Set(groups.map(group => group.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => groupIds.has(id))))
  }, [groups])

  const columns: ColumnDef<UserGroup>[] = [
    {
      id: 'name',
      accessorFn: group => group.name,
      header: 'Group',
      size: 480,
      meta: { label: 'Group', skeleton: { kind: 'stacked' } },
      cell: ({ row }) => (
        <Link href={`/security/groups/${row.original.id}`}>
          <div className='font-medium hover:underline hover:text-primary'>{row.original.name}</div>
          <div className='text-xs text-foreground-muted'>{row.original.description}</div>
        </Link>
      )
    },
    {
      id: 'role',
      accessorFn: group => group.role,
      header: 'Role',
      size: 128,
      meta: { label: 'Role', skeleton: { kind: 'text', width: 'w-20' } },
      cell: ({ row }) => <span className='capitalize text-sm text-foreground-muted'>{row.original.role}</span>
    }
  ]

  const deleteGroups = async (targets: UserGroup[]) => {
    if (targets.length === 0) return
    setIsSaving(true)
    try {
      const results = await Promise.all(targets.map(group => deleteUserGroupAction(group.id)))
      const deletedIds = new Set(
        results
          .map((result, index) => (result.ok ? targets[index]?.id : null))
          .filter((id): id is string => Boolean(id))
      )
      onGroupsDeleted(deletedIds)
      setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
      setPendingDeleteGroups([])
      const failedCount = results.length - deletedIds.size
      const firstError = results.find(result => !result.ok)?.error.message
      toast(
        failedCount > 0
          ? {
              title: 'Some groups could not be deleted',
              description: firstError ?? `${failedCount} delete request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'danger'
            }
          : { title: 'Selected groups deleted', variant: 'success' }
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Section
        surface='plain'
        title='Groups'
        description='Groups provide default permissions and quotas. User-level settings can override them when needed.'
        headingSpacing='default'
        contentClassName='gap-3'
      >
        <DataGridWorkspace
          search={searchDraft}
          searchPlaceholder='Search groups'
          onSearchChange={setSearchDraft}
          onSearch={setSearch}
          filters={
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
          }
          activeFilters={
            roleFilter === 'all'
              ? []
              : [{ id: 'role', label: 'Role', value: roleFilter, onRemove: () => setRoleFilter('all') }]
          }
          onResetFilters={() => setRoleFilter('all')}
          selectedCount={selectedGroups.length}
          bulkActions={
            <Button
              type='button'
              variant='danger'
              disabled={isSaving}
              onClick={() => setPendingDeleteGroups(selectedGroups)}
            >
              <IconTrash className='size-4' />
              Delete selected
            </Button>
          }
        >
          <DataGrid
            columns={columns}
            data={sortedGroups}
            totalItems={sortedGroups.length}
            pageIndex={0}
            pageSize={Math.max(sortedGroups.length, 1)}
            getRowId={group => group.id}
            sorting={sorting}
            onSortingChange={updater =>
              setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
            }
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            minWidth='38rem'
            emptyState={<div className='text-center text-foreground-muted'>No groups have been created.</div>}
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedGroups.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      disabled={isSaving}
                      onSelect={() => setPendingDeleteGroups(selectedGroups)}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Delete selected ({selectedGroups.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/security/groups/${row.original.id}`}>Open group</Link>
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-danger focus:text-danger'
                    disabled={isSaving}
                    onSelect={() => setPendingDeleteGroups([row.original])}
                  >
                    <IconTrash className='mr-2 size-4' />
                    Delete
                  </ContextMenuItem>
                </>
              )
            }}
          />
        </DataGridWorkspace>
      </Section>
      <ConfirmMutationDialog
        open={pendingDeleteGroups.length > 0}
        title={
          pendingDeleteGroups.length === 1
            ? `Delete ${pendingDeleteGroups[0]?.name}?`
            : `Delete ${pendingDeleteGroups.length} selected groups?`
        }
        description='This removes the selected groups from the user store.'
        consequence='Users assigned to these groups will fall back to their role defaults.'
        confirmLabel={pendingDeleteGroups.length === 1 ? 'Delete group' : 'Delete groups'}
        pending={isSaving}
        pendingLabel='Deleting…'
        confirmDisabled={pendingDeleteGroups.length === 0}
        onConfirm={() => void deleteGroups(pendingDeleteGroups)}
        onOpenChange={open => {
          if (!open) setPendingDeleteGroups([])
        }}
      />
    </>
  )
}
