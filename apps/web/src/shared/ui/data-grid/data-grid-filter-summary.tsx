import { IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DataGridFilterEntry } from './data-grid-workspace'

export const DataGridFilterSummary = ({
  filters,
  disabled,
  onReset,
  onBeforeRemove
}: {
  filters: DataGridFilterEntry[]
  disabled: boolean
  onReset?: () => void
  onBeforeRemove: () => void
}) => (
  <div
    data-slot='filter-summary'
    role='group'
    aria-label='Active filters'
    className='scrollbar-thin flex h-10 min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden px-1 touch:h-14'
  >
    {filters.map(filter => (
      <Badge
        key={filter.id}
        variant='neutral'
        className='shrink-0 gap-1 py-1 font-normal touch:relative touch:min-h-11 touch:pr-7'
      >
        <span className='text-foreground-muted'>{filter.label}</span>
        <span
          className='max-w-64 truncate'
          title={filter.value}
        >
          {filter.value}
        </span>
        <button
          type='button'
          disabled={disabled}
          className='ml-1 rounded-control hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch:absolute touch:inset-0 touch:ml-0 touch:flex touch:items-center touch:justify-end touch:pr-2'
          aria-label={`Remove ${filter.label} filter`}
          onClick={() => {
            onBeforeRemove()
            filter.onRemove()
          }}
        >
          <IconX className='size-3' />
        </button>
      </Badge>
    ))}
    {onReset && filters.length > 1 ? (
      <Button
        type='button'
        size='sm'
        variant='ghost'
        disabled={disabled}
        onClick={() => {
          onBeforeRemove()
          onReset()
        }}
      >
        Clear all
      </Button>
    ) : null}
  </div>
)
