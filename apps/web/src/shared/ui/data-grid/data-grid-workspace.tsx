'use client'

import { useRef, useState, type ReactNode } from 'react'
import { IconFilter, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DataGridEmptyContext } from './data-grid-empty-state'
import { DataGridFilterSummary } from './data-grid-filter-summary'
import { DataGridToolbar } from './data-grid-toolbar'
import { DataGridColumnToolbarContext } from './data-grid-toolbar-context'
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
  searchLabel?: string
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
  columnsInToolbar?: boolean
  children: ReactNode
  className?: string
}

const reservePageToolbarSpace = (toolbar: HTMLDivElement | null) => {
  const page = toolbar?.closest<HTMLElement>(`.${styles.page}`)
  if (!toolbar || !page) return

  const measure = () => {
    page.style.setProperty('--page-toolbar-width', `${toolbar.getBoundingClientRect().width}px`)
  }
  measure()
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
  observer?.observe(toolbar, { box: 'border-box' })
  return () => {
    observer?.disconnect()
    page.style.removeProperty('--page-toolbar-width')
  }
}

export const DataGridWorkspace = ({
  search,
  appliedSearch = search,
  searchPlaceholder,
  searchLabel,
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
  columnsInToolbar = false,
  children,
  className
}: DataGridWorkspaceProps) => {
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columnToolbarTarget, setColumnToolbarTarget] = useState<HTMLDivElement | null>(null)
  const hasFilters = Boolean(filters)
  const filterCount = activeFilters.length
  const hasActiveFilters = filterCount > 0
  const hasSelection = selectionMode || selectedCount > 0
  const compact = toolbarLayout === 'compact'

  return (
    <Sheet
      open={filtersOpen}
      onOpenChange={setFiltersOpen}
    >
      <div className={cn('grid min-w-0 gap-3', className)}>
        {notice}
        <div className={cn('grid min-w-0 gap-1', styles.toolbarArea)}>
          <div
            ref={reservePageToolbarSpace}
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
                searchLabel={searchLabel}
                onSearchChange={onSearchChange}
                onSearchSubmit={onSearch}
                filterControl={
                  hasFilters ? (
                    <SheetTrigger
                      render={
                        <Button
                          ref={filterTriggerRef}
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
                        <IconFilter
                          className={cn('size-4', hasActiveFilters && (compact ? 'hidden max-sm:block' : 'hidden'))}
                        />
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
                  ) : undefined
                }
                searchActions={
                  <>
                    {searchActions}
                    {columnsInToolbar ? (
                      <div
                        ref={setColumnToolbarTarget}
                        data-slot='data-grid-column-controls'
                        className='flex h-9 w-9 shrink-0 touch:size-11'
                      />
                    ) : null}
                  </>
                }
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

          {hasFilters && hasActiveFilters ? (
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
            hasFilters: hasActiveFilters,
            disabled,
            clearSearch: () => {
              onSearchChange('')
              void onSearch('')
            },
            clearFilters: onResetFilters
          }}
        >
          <DataGridColumnToolbarContext.Provider value={columnsInToolbar ? columnToolbarTarget : undefined}>
            <div className='grid min-w-0 gap-3'>{children}</div>
          </DataGridColumnToolbarContext.Provider>
        </DataGridEmptyContext.Provider>

        {hasFilters ? (
          <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-md'>
            <SheetHeader className='shrink-0 px-6 pt-6 pr-16 pb-4 text-left'>
              <SheetTitle>{filterTitle}</SheetTitle>
              <SheetDescription>{filterDescription ?? 'Filters apply as you change them.'}</SheetDescription>
            </SheetHeader>
            <div className='scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6'>
              <fieldset
                disabled={disabled}
                className='grid min-w-0 gap-5'
              >
                {filters}
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
