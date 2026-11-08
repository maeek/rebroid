'use client'

import { useRef, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { GroupMembershipGrid, type Membership } from './group-membership-grid'
import { GroupMembershipPicker } from './group-membership-picker'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const GroupMembershipEditor = ({
  groups,
  selectedGroupIds,
  onChange,
  disabled = false,
  loading = false
}: {
  groups: UserGroup[]
  selectedGroupIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  loading?: boolean
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const query = search.trim().toLowerCase()
  const groupsById = new Map(groups.map(group => [group.id, group]))
  const rows = selectedGroupIds
    .map((id, index): Membership => ({ id, group: groupsById.get(id), priority: index + 1 }))
    .filter(row => `${row.group?.name ?? row.id} ${row.group?.description ?? ''}`.toLowerCase().includes(query))
  const currentPage = Math.min(pageIndex, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
  const move = (id: string, offset: number) => {
    const index = selectedGroupIds.indexOf(id)
    const next = [...selectedGroupIds]
    if (index < 0 || index + offset < 0 || index + offset >= next.length) return
    const moving = next[index]
    next[index] = next[index + offset]
    next[index + offset] = moving
    onChange(next)
  }
  return (
    <div className='grid min-w-0 gap-4'>
      <p
        className='text-sm text-foreground-muted'
        aria-live='polite'
      >
        {selectedGroupIds.length} assigned {selectedGroupIds.length === 1 ? 'group' : 'groups'}. Changes apply when you
        save.
      </p>
      <DataGridWorkspace
        search={search}
        searchPlaceholder='Search assigned groups'
        onSearchChange={value => {
          setSearch(value)
          setPageIndex(0)
        }}
        onSearch={() => undefined}
        disabled={loading || disabled}
        actions={
          <Button
            type='button'
            variant='secondary'
            ref={triggerRef}
            disabled={disabled || loading}
            onClick={() => {
              setSelection([...selectedGroupIds])
              setOpen(true)
            }}
          >
            <IconPlus className='size-4' />
            Edit membership
          </Button>
        }
      >
        <GroupMembershipGrid
          disabled={disabled}
          membershipCount={selectedGroupIds.length}
          onMove={move}
          onRemove={id => onChange(selectedGroupIds.filter(value => value !== id))}
          data={rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
          totalItems={rows.length}
          pageIndex={currentPage}
          pageSize={pageSize}
          getRowId={row => row.id}
          loading={loading && { rowCount: 3 }}
          emptyState={
            <p className='text-center text-sm text-foreground-muted'>
              {search ? 'No assigned groups match your search.' : 'No groups assigned. The default group applies.'}
            </p>
          }
        />
        <DataGridPagination
          pageIndex={currentPage}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20]}
          totalItems={rows.length}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          loading={loading}
        />
      </DataGridWorkspace>
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent
          data-editor-dialog=''
          initialFocus={titleRef}
          finalFocus={triggerRef}
          className='sm:max-w-xl'
        >
          <DialogHeader>
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
            >
              Edit group membership
            </DialogTitle>
            <DialogDescription>
              Search and select multiple groups. Adjust their priority in the membership table after applying.
            </DialogDescription>
          </DialogHeader>
          <FormField
            layout='vertical'
            label='Groups'
            description='Removing every group restores the default group. This updates the draft; save the user to persist it.'
          >
            <GroupMembershipPicker
              groups={groups}
              selectedGroupIds={selection}
              onChange={setSelection}
              disabled={disabled}
            />
          </FormField>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={disabled}
              onClick={() => {
                onChange(selection)
                setOpen(false)
              }}
            >
              Apply membership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
