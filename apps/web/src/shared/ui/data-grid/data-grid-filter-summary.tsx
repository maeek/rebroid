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
    className='scrollbar-thin flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden transform-gpu'
  >
    {filters.map(filter => (
      <div
        key={filter.id}
        className='touch-control relative flex shrink-0 items-center'
      >
        <button
          type='button'
          disabled={disabled}
          className='peer absolute inset-0 cursor-pointer rounded-control focus-visible:outline-none disabled:cursor-default'
          aria-label={`Remove ${filter.label} filter`}
          title={filter.value}
          onClick={() => {
            onBeforeRemove()
            filter.onRemove()
          }}
        />
        <Badge
          aria-hidden
          variant='neutral'
          className='pointer-events-none gap-1 font-normal peer-enabled:peer-hover:bg-surface-band peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-inset'
        >
          <span className='text-foreground-muted'>{filter.label}</span>
          <span className='max-w-64 truncate'>{filter.value}</span>
          <IconX className='ml-1 size-3' />
        </Badge>
      </div>
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
