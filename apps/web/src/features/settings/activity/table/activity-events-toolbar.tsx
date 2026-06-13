import { IconCalendarStats, IconDotsVertical, IconDownload, IconFilter, IconTrash, IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DataGridToolbar } from '@/shared/ui/data-grid'
import { useActivityController } from '../activity-context'

export const ActivityEventsToolbar = () => {
  const controller = useActivityController()

  return (
    <div className='flex flex-col gap-3 py-3'>
      <DataGridToolbar
        search={controller.localFilters.search ?? ''}
        searchPlaceholder='Search actor, action, resource, or details'
        onSearchChange={value => controller.setLocalFilters(current => ({ ...current, search: value }))}
        onSearchSubmit={controller.applyFilters}
        onFiltersOpen={() => controller.setFilterPanelOpen(true)}
        activeFilterCount={controller.activeFilters.length}
        actions={
          <>
            <Button
              variant='secondary'
              className='max-lg:w-full'
              asChild
            >
              <a href={controller.exportHref}>
                <IconDownload className='size-4' />
                Export CSV
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='secondary'
                  className='max-lg:w-full lg:size-9 lg:px-0'
                  aria-label='Activity actions'
                >
                  <IconDotsVertical className='size-4' />
                  <span className='lg:hidden'>More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Activity log</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => controller.setRetentionOpen(true)}>
                  <IconCalendarStats className='mr-2 size-4' />
                  Retention settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  onClick={() => controller.setPurgeOpen(true)}
                >
                  <IconTrash className='mr-2 size-4' />
                  Purge all logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className='flex min-h-7 flex-wrap items-center gap-2'>
        <span className='flex items-center gap-1 text-sm text-foreground-muted'>
          <IconFilter className='size-4' />
          {controller.activeFilters.length === 0
            ? 'No filters applied'
            : `${controller.activeFilters.length} active filters`}
        </span>
        {controller.activeFilters.map(({ key, label, value }) => (
          <Badge
            key={`${label}:${value}`}
            variant='secondary'
            className='gap-1 py-1 font-normal'
          >
            <span className='text-foreground-muted'>{label}</span>
            {value}
            <button
              type='button'
              className='ml-1 rounded-full hover:text-foreground'
              onClick={() => controller.removeFilter(key)}
              aria-label={`Remove ${label} filter`}
            >
              <IconX className='size-3' />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
