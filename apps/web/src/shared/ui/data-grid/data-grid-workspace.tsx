'use client'

import { useState, type ReactNode } from 'react'
import { IconFilter, IconRestore, IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DataGridEmptyContext } from './data-grid-empty-state'
import { DataGridToolbar } from './data-grid-toolbar'

export type DataGridFilterEntry = {
  id: string
  label: string
  value: string
  onRemove: () => void
}

export type DataGridWorkspaceProps = {
  search: string
  appliedSearch?: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onSearch: (value: string) => void
  filters?: ReactNode
  filterTitle?: string
  filterDescription?: string
  activeFilters?: DataGridFilterEntry[]
  onResetFilters?: () => void
  selectedCount?: number
  selectionMode?: boolean
  bulkActions?: ReactNode
  searchActions?: ReactNode
  toolbarAction?: ReactNode
  actions?: ReactNode
  notice?: ReactNode
  disabled?: boolean
  toolbarLayout?: 'spread' | 'compact'
  children: ReactNode
  className?: string
}

export const DataGridWorkspace = ({
  search,
  appliedSearch = search,
  searchPlaceholder,
  onSearchChange,
  onSearch,
  filters,
  filterTitle = 'Filters',
  filterDescription,
  activeFilters = [],
  onResetFilters,
  selectedCount = 0,
  selectionMode = false,
  bulkActions,
  searchActions,
  toolbarAction,
  actions,
  notice,
  disabled = false,
  toolbarLayout = 'spread',
  children,
  className
}: DataGridWorkspaceProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasFilters = Boolean(filters)
  const hasSelection = selectionMode || selectedCount > 0
  const compact = toolbarLayout === 'compact'

  return (
    <Sheet
      open={filtersOpen}
      onOpenChange={setFiltersOpen}
    >
      <div className={cn('grid min-w-0 gap-3', className)}>
        {notice}
        <div className='grid min-w-0 gap-2'>
          <div
            data-slot='data-grid-toolbar'
            className={cn(
              'grid min-w-0 items-center [&_button]:transition-none',
              toolbarAction && 'grid-cols-[minmax(0,1fr)_auto]',
              compact && 'sm:w-fit sm:max-w-full'
            )}
          >
            <div
              className={cn('col-start-1 row-start-1 min-w-0', hasSelection && 'invisible')}
              inert={hasSelection}
              aria-hidden={hasSelection || undefined}
            >
              <DataGridToolbar
                search={search}
                searchPlaceholder={searchPlaceholder}
                onSearchChange={onSearchChange}
                onSearchSubmit={onSearch}
                filterControl={
                  hasFilters ? (
                    <SheetTrigger
                      render={
                        <Button
                          type='button'
                          variant='ghost'
                          className={compact ? 'relative max-sm:size-9 max-sm:px-0' : undefined}
                          disabled={disabled}
                        />
                      }
                    >
                      <IconFilter className={cn('size-4', compact && activeFilters.length > 0 && 'text-primary')} />
                      <span className={compact ? 'max-sm:sr-only' : undefined}>
                        Filters
                        {activeFilters.length > 0 ? ` (${activeFilters.length})` : null}
                      </span>
                      {compact && activeFilters.length > 0 ? (
                        <span
                          aria-hidden
                          className='absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary sm:hidden'
                        />
                      ) : null}
                    </SheetTrigger>
                  ) : undefined
                }
                searchActions={searchActions}
                actions={actions}
                disabled={disabled}
                layout={toolbarLayout}
              />
            </div>
            {bulkActions || hasSelection ? (
              <div
                className={cn(
                  'col-start-1 row-start-1 flex min-h-9 min-w-0 items-center',
                  compact ? 'gap-2 max-sm:gap-1' : 'gap-3 rounded-control bg-surface-editor px-3',
                  !hasSelection && 'invisible'
                )}
                inert={!hasSelection}
                aria-hidden={!hasSelection || undefined}
              >
                <span
                  className='shrink-0 text-sm tabular-nums text-foreground-muted'
                  aria-live='polite'
                >
                  {selectedCount} selected
                </span>
                <div
                  className={cn(
                    'ml-auto flex min-w-0 items-center gap-2 overflow-x-auto',
                    compact ? 'max-sm:gap-1' : 'py-1'
                  )}
                >
                  {bulkActions}
                </div>
              </div>
            ) : null}
            {toolbarAction ? <div className='col-start-2 row-start-1'>{toolbarAction}</div> : null}
          </div>

          {activeFilters.length > 0 ? (
            <div className='flex min-h-7 flex-wrap items-center gap-2'>
              {activeFilters.map(filter => (
                <Badge
                  key={filter.id}
                  variant='neutral'
                  className='gap-1 py-1 font-normal touch:relative touch:min-h-11 touch:pr-7'
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
                    onClick={filter.onRemove}
                  >
                    <IconX className='size-3' />
                  </button>
                </Badge>
              ))}
              {onResetFilters && activeFilters.length > 1 ? (
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  disabled={disabled}
                  onClick={onResetFilters}
                >
                  Clear all
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DataGridEmptyContext.Provider
          value={{
            hasSearch: Boolean(appliedSearch.trim()),
            hasFilters: activeFilters.length > 0,
            disabled,
            clearSearch: () => {
              onSearchChange('')
              onSearch('')
            },
            clearFilters: onResetFilters
          }}
        >
          <div className='grid min-w-0 gap-3'>{children}</div>
        </DataGridEmptyContext.Provider>

        {hasFilters ? (
          <SheetContent className='flex w-full flex-col overflow-y-auto sm:max-w-md'>
            <SheetHeader className='pr-6 text-left'>
              <SheetTitle>{filterTitle}</SheetTitle>
              <SheetDescription>{filterDescription ?? 'Refine the rows shown in this grid.'}</SheetDescription>
            </SheetHeader>
            <fieldset
              disabled={disabled}
              className='mt-4 grid min-w-0 gap-5'
            >
              {filters}
            </fieldset>
            <div className='mt-auto flex items-center justify-between gap-3 border-t border-surface-border/50 pt-4'>
              <Button
                type='button'
                variant='ghost'
                disabled={disabled || !activeFilters.length || !onResetFilters}
                onClick={onResetFilters}
              >
                <IconRestore className='size-4' /> Reset
              </Button>
              <Button
                type='button'
                onClick={() => setFiltersOpen(false)}
              >
                Done
              </Button>
            </div>
          </SheetContent>
        ) : null}
      </div>
    </Sheet>
  )
}
