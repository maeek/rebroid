import { IconCalendarStats, IconDotsVertical, IconDownload, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { auditExportLimit } from '@/shared/model/audit-export'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { useActivityController, useActivityData } from '../activity-context'
import styles from '../activity-events.module.css'

export const ActivityEventsRefresh = () => {
  const controller = useActivityController()
  const { application, loading, result } = useActivityData()

  return (
    <PlatformPageRefreshButton
      variant={application ? 'secondary' : undefined}
      className={application ? styles.appRefresh : undefined}
      refreshResult={{ version: result, succeeded: !loading }}
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
  const limitedExport = result.total > auditExportLimit
  const iconOnNarrow = application && !limitedExport
  const exportLabel = limitedExport ? `Export first ${auditExportLimit.toLocaleString('en-US')}` : 'Export CSV'
  const exportContent = (
    <>
      <IconDownload
        className='size-4'
        aria-hidden
      />
      <span className={iconOnNarrow ? styles.appExportLabel : undefined}>{exportLabel}</span>
    </>
  )
  return (
    <>
      {application ? <ActivityEventsRefresh /> : null}
      <Button
        aria-label={exportLabel}
        className={cn(iconOnNarrow && styles.appExport)}
        title={`Export up to ${auditExportLimit.toLocaleString('en-US')} matching events in the current sort order`}
        variant='secondary'
        asChild={!busy}
        disabled={busy}
      >
        {busy ? exportContent : <a href={controller.exportHref}>{exportContent}</a>}
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
              <IconCalendarStats className='size-4' />
              Retention settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-danger focus:text-danger'
              onClick={() => controller.setPurgeOpen(true)}
            >
              <IconTrash className='size-4' />
              Purge all logs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}
