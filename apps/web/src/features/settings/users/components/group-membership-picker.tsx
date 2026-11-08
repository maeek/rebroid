'use client'

import { MultiSelectCombobox, type MultiSelectComboboxOption } from '@/components/ui/multi-select-combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { UserGroup } from '@/shared/contracts/auth-user'

export const GroupMembershipPicker = ({
  groups,
  selectedGroupIds,
  onChange,
  className,
  disabled = false,
  loading = false,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid
}: {
  groups: UserGroup[]
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
  className?: string
  disabled?: boolean
  loading?: boolean
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) => {
  const options: MultiSelectComboboxOption[] = groups.map(group => ({
    value: group.id,
    label: group.name,
    description: group.description,
    keywords: [group.role]
  }))

  return (
    <div className={cn('grid w-full min-w-0 gap-3', className)}>
      <MultiSelectCombobox
        className='max-h-40 overflow-y-auto'
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled || loading}
        value={selectedGroupIds}
        options={options}
        placeholder='Search and add groups'
        emptyLabel='No groups match your search.'
        onValueChange={onChange}
      />
      <p
        className='text-xs text-foreground-muted'
        aria-live='polite'
      >
        {loading ? (
          <Skeleton
            as='span'
            className='block h-4 w-40'
          />
        ) : (
          `${selectedGroupIds.length} of ${groups.length} groups selected`
        )}
      </p>
    </div>
  )
}
