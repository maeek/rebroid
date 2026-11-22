'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DataGridEmptyContext } from './data-grid-empty-state'
import { DataGridFilterSheetContent, DataGridFilterTrigger } from './data-grid-filter-controls'
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

type DataGridWorkspaceProps = {
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
  stickyMobileSelection?: boolean
  bulkActions?: ReactNode
  searchActions?: ReactNode
  toolbarAction?: ReactNode
  actions?: ReactNode
  refresh?: ReactNode
  notice?: ReactNode
  disabled?: boolean
  updating?: boolean
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
  stickyMobileSelection = false,
  bulkActions,
  searchActions,
  toolbarAction,
  actions,
  refresh,
  notice,
  disabled = false,
  updating,
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
        <div
          className={cn(
            'grid min-w-0 gap-1',
            styles.toolbarArea,
            stickyMobileSelection && hasSelection && 'max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-background'
          )}
        >
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
                    <DataGridFilterTrigger
                      filterCount={filterCount}
                      compact={compact}
                      disabled={disabled}
                      triggerRef={filterTriggerRef}
                    />
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
                    'ml-auto flex min-w-0 items-center gap-2 overflow-x-auto transform-gpu',
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
          {updating !== undefined ? (
            <div
              role={updating && !disabled ? 'status' : undefined}
              aria-live='polite'
              aria-atomic='true'
              className='min-h-5 text-xs leading-5 text-foreground-muted'
            >
              {updating && !disabled ? 'Updating results…' : ''}
            </div>
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
          <DataGridFilterSheetContent
            title={filterTitle}
            description={filterDescription}
            disabled={disabled}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={onResetFilters}
            onClose={() => setFiltersOpen(false)}
          >
            {filters}
          </DataGridFilterSheetContent>
        ) : null}
      </div>
    </Sheet>
  )
}
