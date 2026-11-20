import type { ReactNode, Ref } from 'react'
import { IconFilter, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export const DataGridFilterTrigger = ({
  filterCount,
  compact,
  disabled,
  triggerRef
}: {
  filterCount: number
  compact: boolean
  disabled: boolean
  triggerRef: Ref<HTMLButtonElement>
}) => {
  const hasActiveFilters = filterCount > 0

  return (
    <SheetTrigger
      render={
        <Button
          ref={triggerRef}
          type='button'
          aria-label={hasActiveFilters ? `Filters (${filterCount})` : 'Filters'}
          variant='ghost'
          className={cn(
            'px-3 data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground',
            compact && 'relative max-sm:size-9 max-sm:px-0'
          )}
          disabled={disabled}
        />
      }
    >
      <span
        aria-hidden
        className='flex size-4 shrink-0 items-center justify-center'
      >
        <IconFilter className={cn('size-4', hasActiveFilters && (compact ? 'hidden max-sm:block' : 'hidden'))} />
        {hasActiveFilters ? (
          <span
            className={cn(
              'min-w-5 rounded-full bg-accent px-1 text-center text-xs leading-5 tabular-nums text-accent-foreground',
              compact && 'max-sm:hidden'
            )}
          >
            {filterCount > 99 ? '99+' : filterCount}
          </span>
        ) : null}
      </span>
      <span className={compact ? 'max-sm:sr-only' : undefined}>Filters</span>
      {compact && hasActiveFilters ? (
        <span
          aria-hidden
          className='absolute end-1.5 top-1.5 size-1.5 rounded-full bg-primary sm:hidden'
        />
      ) : null}
    </SheetTrigger>
  )
}

export const DataGridFilterSheetContent = ({
  title,
  description,
  disabled,
  hasActiveFilters,
  onResetFilters,
  onClose,
  children
}: {
  title: string
  description?: string
  disabled: boolean
  hasActiveFilters: boolean
  onResetFilters?: () => void
  onClose: () => void
  children: ReactNode
}) => (
  <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-md'>
    <SheetHeader className='shrink-0 px-6 pt-6 pr-16 pb-4 text-left'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description ?? 'Filters apply as you change them.'}</SheetDescription>
    </SheetHeader>
    <div className='scrollbar-thin min-h-0 flex-1 overflow-y-auto transform-gpu px-6 pt-2 pb-6'>
      <fieldset
        disabled={disabled}
        className='grid min-w-0 gap-5'
      >
        {children}
      </fieldset>
    </div>
    <div className='mx-6 flex shrink-0 items-center justify-between gap-3 border-t border-surface-border/50 pt-4 pb-6'>
      <Button
        type='button'
        variant='ghost'
        disabled={disabled || !hasActiveFilters || !onResetFilters}
        onClick={onResetFilters}
      >
        <IconRestore className='size-4' /> Reset filters
      </Button>
      <Button
        type='button'
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  </SheetContent>
)
