'use client'

import { type FormEvent, type ReactNode } from 'react'
import { IconFilter, IconSearch } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type DataGridToolbarProps = {
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  filters?: ReactNode
  onFiltersOpen?: () => void
  activeFilterCount?: number
  selectedCount?: number
  actions?: ReactNode
  disabled?: boolean
}

export function DataGridToolbar({
  search,
  searchPlaceholder,
  onSearchChange,
  onSearchSubmit,
  filters,
  onFiltersOpen,
  activeFilterCount = 0,
  selectedCount = 0,
  actions,
  disabled = false
}: DataGridToolbarProps) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearchSubmit()
  }

  const filterButtonLabel = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'

  return (
    <form
      aria-busy={disabled || undefined}
      className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'
      onSubmit={submitSearch}
    >
      <fieldset
        className='contents'
        disabled={disabled}
      >
        <div className='flex w-full flex-wrap items-end gap-2 lg:min-w-0 lg:flex-1'>
          <div className='relative w-full max-w-md'>
            <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted' />
            <Input
              value={search}
              placeholder={searchPlaceholder}
              className='pl-9'
              onChange={event => onSearchChange(event.target.value)}
            />
          </div>
          <Button type='submit'>
            <IconSearch className='size-4' />
            Search
          </Button>
          {filters ? (
            <>
              <div className='hidden lg:block'>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type='button'
                      variant='secondary'
                    >
                      <IconFilter className='size-4' />
                      {filterButtonLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align='start'
                    className='w-[24rem]'
                  >
                    <div className='grid gap-3'>{filters}</div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className='lg:hidden'>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button
                      type='button'
                      variant='secondary'
                    >
                      <IconFilter className='size-4' />
                      {filterButtonLabel}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className='max-h-[85dvh] overflow-y-auto px-4 pb-6 pt-5'>
                    <DrawerTitle>Filters</DrawerTitle>
                    <DrawerDescription className='sr-only'>Refine the rows shown in this grid.</DrawerDescription>
                    <div className='mt-4 grid gap-3'>{filters}</div>
                  </DrawerContent>
                </Drawer>
              </div>
            </>
          ) : onFiltersOpen ? (
            <Button
              type='button'
              variant='secondary'
              onClick={onFiltersOpen}
            >
              <IconFilter className='size-4' />
              {filterButtonLabel}
            </Button>
          ) : null}
        </div>
        <div className='flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-3'>
          {selectedCount > 0 ? <span className='text-sm text-foreground-muted'>{selectedCount} selected</span> : null}
          {actions}
        </div>
      </fieldset>
    </form>
  )
}
