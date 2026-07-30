'use client'

import { useState, type ReactNode } from 'react'
import { IconFilter, IconRestore, IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { DataGridToolbar } from './data-grid-toolbar'

export type DataGridFilterEntry = {
  id: string
  label: string
  value: string
  onRemove: () => void
}

export type DataGridWorkspaceProps = {
  search: string
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
  children: ReactNode
  className?: string
}

const FilterContent = ({
  title,
  description,
  filters,
  canReset,
  onReset
}: {
  title: string
  description?: string
  filters: ReactNode
  canReset: boolean
  onReset: () => void
}) => (
  <div className='grid gap-5'>
    <div className='flex items-start justify-between gap-3'>
      <div className='grid gap-1'>
        <h2 className='font-medium'>{title}</h2>
        {description ? <p className='text-xs leading-5 text-foreground-muted'>{description}</p> : null}
      </div>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        disabled={!canReset}
        onClick={onReset}
      >
        <IconRestore className='size-4' />
        Reset
      </Button>
    </div>
    <div className='grid gap-5'>{filters}</div>
  </div>
)

export const DataGridWorkspace = ({
  search,
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
  children,
  className
}: DataGridWorkspaceProps) => {
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const hasFilters = Boolean(filters)
  const filterContent = hasFilters ? (
    <FilterContent
      title={filterTitle}
      description={filterDescription}
      filters={filters}
      canReset={activeFilters.length > 0}
      onReset={onResetFilters ?? (() => undefined)}
    />
  ) : null

  const openFilters = () => {
    const desktop = window.matchMedia?.('(min-width: 1024px)').matches ?? window.innerWidth >= 1024

    if (desktop) {
      setDesktopFiltersOpen(open => !open)
      return
    }
    setMobileFiltersOpen(true)
  }

  return (
    <div className={cn('grid min-w-0 gap-4', className)}>
      {notice}
      <DataGridToolbar
        search={search}
        searchPlaceholder={searchPlaceholder}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearch}
        onFiltersOpen={hasFilters ? openFilters : undefined}
        activeFilterCount={activeFilters.length}
        actions={actions}
        disabled={disabled}
      />

      {activeFilters.length > 0 ? (
        <div className='flex min-h-7 flex-wrap items-center gap-2'>
          <span className='flex items-center gap-1 text-sm text-foreground-muted'>
            <IconFilter className='size-4' />
            {activeFilters.length} active filter{activeFilters.length === 1 ? '' : 's'}
          </span>
          {activeFilters.map(filter => (
            <Badge
              key={filter.id}
              variant='neutral'
              className='gap-1 py-1 font-normal'
            >
              <span className='text-foreground-muted'>{filter.label}</span>
              {filter.value}
              <button
                type='button'
                className='ml-1 rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                aria-label={`Remove ${filter.label} filter`}
                onClick={filter.onRemove}
              >
                <IconX className='size-3' />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-control border border-primary/25 bg-primary/8 px-4 py-3'>
          <span className='text-sm text-foreground-muted'>{selectedCount} selected</span>
          <div className='flex flex-wrap items-center gap-2'>{bulkActions}</div>
        </div>
      ) : null}

      <div
        className={cn('grid min-w-0 items-start gap-5', {
          'lg:grid-cols-[minmax(0,1fr)_20rem]': hasFilters && desktopFiltersOpen
        })}
      >
        <div className='grid min-w-0 gap-4'>{children}</div>
        {hasFilters && desktopFiltersOpen ? (
          <aside
            aria-label={filterTitle}
            className='sticky top-4 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-panel border border-surface-border/70 bg-surface-panel/55 p-5 shadow-panel lg:block'
          >
            {filterContent}
          </aside>
        ) : null}
      </div>

      {hasFilters ? (
        <Drawer
          open={mobileFiltersOpen}
          onOpenChange={setMobileFiltersOpen}
        >
          <DrawerContent className='max-h-[85dvh] overflow-y-auto px-4 pb-6 pt-5 lg:hidden'>
            <DrawerTitle>{filterTitle}</DrawerTitle>
            <DrawerDescription className='sr-only'>Refine the rows shown in this grid.</DrawerDescription>
            <div className='mt-4'>{filterContent}</div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  )
}
