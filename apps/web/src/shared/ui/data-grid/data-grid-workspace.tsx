'use client'

import { useRef, useState, type ReactNode } from 'react'
import { IconFilter, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DataGridEmptyContext } from './data-grid-empty-state'
import { DataGridFilterSummary } from './data-grid-filter-summary'
import { DataGridToolbar } from './data-grid-toolbar'
import styles from '@/shared/ui/page/page-toolbar.module.css'

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
  onSearch: (value: string) => void | Promise<void>
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
  refresh?: ReactNode
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
  refresh,
  notice,
  disabled = false,
  toolbarLayout = 'spread',
  children,
  className
}: DataGridWorkspaceProps) => {
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
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
        <div className={cn('grid min-w-0 gap-2', styles.toolbarArea)}>
          <div
            data-slot='data-grid-toolbar'
            className={cn(
              'grid min-w-0 items-center [&_button]:transition-none',
              styles.toolbar,
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
                          ref={filterTriggerRef}
                          type='button'
                          aria-label={activeFilters.length ? `Filters (${activeFilters.length})` : 'Filters'}
                          variant='ghost'
                          className={compact ? 'relative max-sm:size-9 max-sm:px-0' : undefined}
                          disabled={disabled}
                        />
                      }
                    >
                      <IconFilter className={cn('size-4', compact && activeFilters.length > 0 && 'text-primary')} />
                      <span className={compact ? 'max-sm:sr-only' : undefined}>Filters</span>
                      <span
                        aria-hidden
                        className={cn(
                          'w-[3ch] text-center tabular-nums',
                          compact && 'max-sm:hidden',
                          !activeFilters.length && 'invisible'
                        )}
                      >
                        {activeFilters.length > 99 ? '99+' : activeFilters.length}
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
                refresh={refresh}
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
            {toolbarAction ? (
              <div className={cn('col-start-2 row-start-1', styles.persistentAction)}>{toolbarAction}</div>
            ) : null}
          </div>

          {hasFilters && activeFilters.length > 0 ? (
            <DataGridFilterSummary
              filters={activeFilters}
              disabled={disabled}
              onReset={onResetFilters}
              onBeforeRemove={() => filterTriggerRef.current?.focus()}
            />
          ) : null}
        </div>

        <DataGridEmptyContext.Provider
          value={{
            hasSearch: Boolean(appliedSearch.trim()),
            hasFilters: activeFilters.length > 0,
            disabled,
            clearSearch: () => {
              onSearchChange('')
              void onSearch('')
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
