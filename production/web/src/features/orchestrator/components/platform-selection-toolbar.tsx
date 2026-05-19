import type { ReactNode } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Visible } from '@/components/ui/visible'

export const PlatformSelectionToolbar = ({
  search,
  placeholder,
  selectedCount,
  actions,
  onSearchChange
}: {
  search: string
  placeholder: string
  selectedCount: number
  actions?: ReactNode
  onSearchChange: (value: string) => void
}) => {
  return (
    <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
      <div className='relative w-full max-w-md'>
        <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          value={search}
          placeholder={placeholder}
          className='pl-9'
          onChange={event => onSearchChange(event.target.value)}
        />
      </div>
      <div className='flex min-h-9 flex-wrap items-center justify-end gap-3'>
        <Visible when={selectedCount > 0}>
          <span className='text-sm text-secondary-foreground'>{selectedCount} selected</span>
        </Visible>
        <Visible when={selectedCount > 0}>{actions}</Visible>
      </div>
    </div>
  )
}
