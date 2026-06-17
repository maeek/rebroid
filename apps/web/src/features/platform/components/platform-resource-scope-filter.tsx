'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type PlatformResourceScope = 'managed' | 'all'

export const PlatformResourceScopeFilter = ({
  value,
  onValueChange
}: {
  value: PlatformResourceScope
  onValueChange: (value: PlatformResourceScope) => void
}) => (
  <Select
    value={value}
    onValueChange={nextValue => onValueChange(nextValue)}
  >
    <SelectTrigger className='w-48'>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value='managed'>Rebroid resources</SelectItem>
      <SelectItem value='all'>All Docker resources</SelectItem>
    </SelectContent>
  </Select>
)
