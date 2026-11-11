import { IconCalendarStats, IconDotsVertical, IconDownload, IconRefresh, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MutationButton } from '@/components/ui/mutation-button'
import { auditExportLimit } from '@/shared/model/audit-export'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { useActivityController, useActivityData } from '../activity-context'

export const ActivityEventsRefresh = () => {
  const controller = useActivityController()
  const { loading } = useActivityData()

  return (
    <PlatformPageRefreshButton
      disabled={loading || controller.isNavigating || controller.isPurging || controller.isSavingRetention}
      isRefreshing={controller.isRefreshing}
      onRefresh={controller.refresh}
    />
  )
}

export const ActivityEventsActions = () => {
  const controller = useActivityController()
  const { application, loading, result } = useActivityData()

  const busy = loading || controller.isNavigating || controller.isPurging || controller.isSavingRetention
  const exportLabel =
    result.total > auditExportLimit ? `Export first ${auditExportLimit.toLocaleString('en-US')}` : 'Export CSV'
  return (
    <>
      {application ? (
        <MutationButton
          variant='ghost'
          disabled={busy}
          pending={controller.isRefreshing}
          pendingLabel='Refreshing…'
          onClick={controller.refresh}
        >
          <IconRefresh className='size-4' /> Refresh
        </MutationButton>
      ) : null}
      <Button
        title={`Export up to ${auditExportLimit.toLocaleString('en-US')} matching events in the current sort order`}
        variant='secondary'
        asChild={!busy}
        disabled={busy}
      >
        {busy ? (
          <>
            <IconDownload className='size-4' />
            {exportLabel}
          </>
        ) : (
          <a href={controller.exportHref}>
            <IconDownload className='size-4' />
            {exportLabel}
          </a>
        )}
      </Button>
      {!application ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={busy}
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
      ) : null}
    </>
  )
}
