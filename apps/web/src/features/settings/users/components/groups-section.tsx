'use client'

import { useEffect, useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { createUserGroupAction } from '@/server/users/actions/create-user-group-action'
import { deleteUserGroupAction } from '@/server/users/actions/delete-user-group-action'
import { DataGrid } from '@/shared/ui/data-grid'
import type { UserGroup } from '@/server/auth/user'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

export const GroupsSection = ({
  groups,
  onGroupUpdated,
  onGroupsDeleted
}: {
  groups: UserGroup[]
  onGroupUpdated: (group: UserGroup) => void
  onGroupsDeleted: (groupIds: Set<string>) => void
}) => {
  const [newGroupName, setNewGroupName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingDeleteGroups, setPendingDeleteGroups] = useState<UserGroup[]>([])
  const sortedGroups = [...groups].sort((left, right) => {
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
      meta: { label: 'Group' },
      cell: ({ row }) => (
        <Link href={`/users/groups/${row.original.id}`}>
          <div className='font-medium hover:underline hover:text-primary'>{row.original.name}</div>
          <div className='text-xs text-muted-foreground'>{row.original.description}</div>
        </Link>
      )
    },
    {
      id: 'role',
      accessorFn: group => group.role,
      header: 'Role',
      size: 128,
      meta: { label: 'Role' },
      cell: ({ row }) => <span className='capitalize text-sm text-secondary-foreground'>{row.original.role}</span>
    }
  ]

  const createGroup = async () => {
    setIsSaving(true)
    try {
      const group = await createUserGroupAction({ name: newGroupName })
      onGroupUpdated(group)
      setNewGroupName('')
      toast({ title: 'Group created' })
    } catch (error) {
      toast({
        title: 'Could not create group',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteGroups = async (targets: UserGroup[]) => {
    if (targets.length === 0) return
    setIsSaving(true)
    try {
      const results = await Promise.allSettled(targets.map(group => deleteUserGroupAction(group.id)))
      const deletedIds = new Set(
        results
          .map((result, index) => (result.status === 'fulfilled' ? targets[index]?.id : null))
          .filter((id): id is string => Boolean(id))
      )
      onGroupsDeleted(deletedIds)
      setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
      setPendingDeleteGroups([])
      const failedCount = results.length - deletedIds.size
      toast(
        failedCount > 0
          ? {
              title: 'Some groups could not be deleted',
              description: `${failedCount} delete request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'destructive'
            }
          : { title: 'Selected groups deleted' }
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Section
        title='Groups'
        titleClassName='pb-2'
        contentClassName='gap-3'
      >
        <Section
          boxed
          contentClassName='gap-3'
        >
          <p className='text-sm text-secondary-foreground'>
            Groups provide default permissions and quotas. User-level settings can override them when needed.
          </p>
          <div className='flex flex-wrap gap-2'>
            <Input
              value={newGroupName}
              className='max-w-sm'
              placeholder='New Group Name'
              onChange={event => setNewGroupName(event.target.value)}
            />
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving || !newGroupName.trim()}
              onClick={() => void createGroup()}
            >
              <IconPlus className='size-4' />
              Create Group
            </Button>
          </div>
        </Section>
        {selectedGroups.length > 0 ? (
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
            <span className='text-secondary-foreground'>{selectedGroups.length} selected</span>
            <Button
              type='button'
              variant='destructive'
              disabled={isSaving}
              onClick={() => setPendingDeleteGroups(selectedGroups)}
            >
              <IconTrash className='size-4' />
              Delete selected
            </Button>
          </div>
        ) : null}
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
          emptyState={<div className='text-center text-secondary-foreground'>No groups have been created.</div>}
          rowContextMenu={row => {
            const hasBulkSelection = selectedIds.has(row.original.id) && selectedGroups.length > 1
            return (
              <>
                {hasBulkSelection ? (
                  <ContextMenuItem
                    className='text-destructive focus:text-destructive'
                    disabled={isSaving}
                    onSelect={() => setPendingDeleteGroups(selectedGroups)}
                  >
                    <IconTrash className='mr-2 size-4' />
                    Delete selected ({selectedGroups.length})
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem asChild>
                  <Link href={`/users/groups/${row.original.id}`}>Open group</Link>
                </ContextMenuItem>
                <ContextMenuItem
                  className='text-destructive focus:text-destructive'
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
      </Section>
      <Dialog
        modal
        open={pendingDeleteGroups.length > 0}
        onOpenChange={open => {
          if (!open) setPendingDeleteGroups([])
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete{' '}
              {pendingDeleteGroups.length === 1
                ? pendingDeleteGroups[0]?.name
                : `${pendingDeleteGroups.length} selected groups`}
              ?
            </DialogTitle>
            <DialogDescription>
              This removes the selected groups from the user store. Users assigned to these groups will fall back to
              their role defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={pendingDeleteGroups.length === 0 || isSaving}
              onClick={() => void deleteGroups(pendingDeleteGroups)}
            >
              <IconTrash className='size-4' />
              Delete Groups
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
