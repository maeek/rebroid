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
  bulkActions?: ReactNode
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
  bulkActions,
  actions,
  notice,
  disabled = false,
  toolbarLayout = 'spread',
  children,
  className
}: DataGridWorkspaceProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasFilters = Boolean(filters)
  const hasSelection = selectedCount > 0

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
            className='grid min-w-0 items-center [&_button]:transition-none'
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
                          disabled={disabled}
                        />
                      }
                    >
                      <IconFilter className='size-4' />
                      {activeFilters.length ? `Filters (${activeFilters.length})` : 'Filters'}
                    </SheetTrigger>
                  ) : undefined
                }
                actions={actions}
                disabled={disabled}
                layout={toolbarLayout}
              />
            </div>
            {bulkActions || hasSelection ? (
              <div
                className={cn(
                  'col-start-1 row-start-1 flex min-h-9 min-w-0 items-center gap-3 rounded-control bg-surface-editor px-3',
                  !hasSelection && 'invisible'
                )}
                inert={!hasSelection}
                aria-hidden={!hasSelection || undefined}
              >
                <span className='shrink-0 text-sm tabular-nums text-foreground-muted'>{selectedCount} selected</span>
                <div className='ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-1'>{bulkActions}</div>
              </div>
            ) : null}
          </div>

          {activeFilters.length > 0 ? (
            <div className='flex min-h-7 flex-wrap items-center gap-2'>
              {activeFilters.map(filter => (
                <Badge
                  key={filter.id}
                  variant='neutral'
                  className='gap-1 py-1 font-normal'
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
                    className='ml-1 rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label={`Remove ${filter.label} filter`}
                    onClick={filter.onRemove}
                  >
                    <IconX className='size-3' />
                  </button>
                </Badge>
              ))}
              {onResetFilters ? (
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
