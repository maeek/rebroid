'use client'

import { useEffect, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { deleteUserGroupAction } from '@/server/users/actions/delete-user-group-action'
import { isBuiltInGroup } from '@/shared/permissions/effective-access'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { UserGroup } from '@/shared/contracts/auth-user'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

export const GroupsSection = ({
  groups,
  loading = false,
  onGroupsDeleted
}: {
  loading?: boolean
  groups: UserGroup[]
  onGroupsDeleted: (groupIds: Set<string>) => void
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingDeleteGroups, setPendingDeleteGroups] = useState<UserGroup[]>([])
  const visibleGroups = groups.filter(group => {
    const query = search.trim().toLowerCase()
    return `${group.name} ${group.description}`.toLowerCase().includes(query)
  })
  const sortedGroups = [...visibleGroups].sort((left, right) => {
    const activeSorting = sorting.length > 0 ? sorting : [{ id: 'name', desc: false }]
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      const result = left.name.localeCompare(right.name)
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
        <ResourceLink href={`/security/groups/${row.original.id}`}>
          <div className='font-medium'>{row.original.name}</div>
          <div className='text-xs text-foreground-muted'>{row.original.description}</div>
        </ResourceLink>
      )
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
        aria-label='Group list'
      >
        <DataGridWorkspace
          disabled={loading}
          search={searchDraft}
          searchPlaceholder='Search groups'
          onSearchChange={setSearchDraft}
          onSearch={setSearch}
          selectedCount={selectedGroups.length}
          bulkActions={
            <Button
              type='button'
              variant='danger-ghost'
              disabled={isSaving}
              onClick={() => setPendingDeleteGroups(selectedGroups)}
            >
              <IconTrash className='size-4' />
              Delete selected
            </Button>
          }
        >
          <DataGrid
            loading={loading}
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
              disabled: loading,
              canSelectId: id => !isBuiltInGroup(id),
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            minWidth='38rem'
            emptyState={
              <DataGridEmptyState
                title='No groups yet'
                description='Create a group to manage shared permissions and quotas.'
              />
            }
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
                  {!isBuiltInGroup(row.original.id) ? (
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      disabled={isSaving}
                      onSelect={() => setPendingDeleteGroups([row.original])}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Delete
                    </ContextMenuItem>
                  ) : null}
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
        consequence='Members lose the permissions and quotas inherited from these groups.'
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
