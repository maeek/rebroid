'use client'

import { MultiSelectCombobox, type MultiSelectComboboxOption } from '@/components/ui/multi-select-combobox'
import { cn } from '@/lib/utils'
import type { UserGroup } from '@/shared/contracts/auth-user'

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
  const options: MultiSelectComboboxOption[] = groups.map(group => ({
    value: group.id,
    label: group.name,
    description: group.description,
    keywords: [group.role]
  }))

  return (
    <div className={cn('grid gap-2', className)}>
      <MultiSelectCombobox
        value={selectedGroupIds}
        options={options}
        placeholder='Search groups'
        emptyLabel='No groups match your search.'
        onValueChange={onChange}
      />
      <p className='text-xs text-foreground-muted'>
        {selectedGroupIds.length} of {groups.length} groups selected
      </p>
    </div>
  )
}
