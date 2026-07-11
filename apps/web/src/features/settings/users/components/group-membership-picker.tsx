'use client'

import { useMemo, useState } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import type { UserGroup } from '@/server/auth/user'

export const GroupMembershipPicker = ({
  groups,
  selectedGroupIds,
  onChange,
  className
}: {
  groups: UserGroup[]
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
  className?: string
}) => {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLowerCase()
  const visibleGroups = useMemo(
    () =>
      normalizedSearch
        ? groups.filter(group =>
            `${group.name} ${group.description} ${group.role}`.toLowerCase().includes(normalizedSearch)
          )
        : groups,
    [groups, normalizedSearch]
  )

  const toggleGroup = (groupId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedGroupIds, groupId])
      return
    }

    onChange(selectedGroupIds.filter(id => id !== groupId))
  }

  return (
    <div className={cn('overflow-hidden', className)}>
      <div className='pb-3'>
        <div className='relative'>
          <IconSearch className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted' />
          <Input
            value={search}
            className='pl-9'
            placeholder='Search groups'
            onChange={event => setSearch(event.target.value)}
          />
        </div>
      </div>
      <ScrollArea className='max-h-80 border-y border-surface-border/60'>
        <div className='divide-y divide-border/50'>
          {visibleGroups.map(group => {
            const checked = selectedGroupIds.includes(group.id)

            return (
              <label
                key={group.id}
                htmlFor={`group-membership-${group.id}`}
                className='flex items-center cursor-pointer gap-4 px-0 py-3 transition-colors'
              >
                <Checkbox
                  id={`group-membership-${group.id}`}
                  checked={checked}
                  className='mt-0.5'
                  onCheckedChange={value => toggleGroup(group.id, value === true)}
                />
                <span className='grid min-w-0 gap-1'>
                  <span className='flex flex-wrap items-center gap-2'>
                    <span className='truncate font-medium'>{group.name}</span>
                    <Badge
                      variant={group.role === 'admin' ? 'success' : 'neutral'}
                      className='text-xs'
                    >
                      {group.role}
                    </Badge>
                  </span>
                  <span className='line-clamp-2 text-xs text-foreground-muted'>{group.description}</span>
                </span>
              </label>
            )
          })}
          <Visible when={visibleGroups.length === 0}>
            <div className='px-4 py-8 text-center text-sm text-foreground-muted'>No groups match your search.</div>
          </Visible>
        </div>
      </ScrollArea>
      <div className='pt-2 text-xs text-foreground-muted'>
        {selectedGroupIds.length} of {groups.length} groups selected
      </div>
    </div>
  )
}
