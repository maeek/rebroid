import { IconCalendarStats, IconDotsVertical, IconDownload, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useActivityController } from '../activity-context'

export const ActivityEventsActions = () => {
  const controller = useActivityController()

  return (
    <>
      <Button
        variant='secondary'
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
            size='icon-md'
            aria-label='Activity actions'
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => controller.setRetentionOpen(true)}>
            <IconCalendarStats className='mr-2 size-4' />
            Retention settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='text-danger focus:text-danger'
            onClick={() => controller.setPurgeOpen(true)}
          >
            <IconTrash className='mr-2 size-4' />
            Purge all logs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
