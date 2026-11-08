'use client'

import { useContainerDetailControllerContext } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'

export const ContainerLogsSection = () => {
  const { isRefreshingLogs, logs, refreshLogs } = useContainerDetailControllerContext()

  return (
    <ContainerLogsContent
      logs={logs}
      isRefreshingLogs={isRefreshingLogs}
      refreshLogs={refreshLogs}
    />
  )
}

export const ContainerLogsContent = ({
  logs,
  isRefreshingLogs = false,
  refreshLogs = () => Promise.resolve(),
  loading = false
}: {
  logs?: { collectedAt: string; output: string }
  isRefreshingLogs?: boolean
  refreshLogs?: () => Promise<void>
  loading?: boolean
}) => {
  return (
    <PlatformResourceSection
      title='Logs'
      surface='plain'
      contentClassName='gap-4'
    >
      <LogsConsole
        loading={loading}
        log={logs}
        isRefreshing={isRefreshingLogs}
        onRefresh={() => void refreshLogs()}
        emptyMessage='No logs returned for this container.'
        collectedAtPrefix='Recent Docker logs collected at'
        formatCollectedAt={formatPlatformDate}
        controls={<p className='text-sm text-foreground-muted'>Recent Docker logs for this container.</p>}
        outputClassName='h-[40dvh] min-h-80 max-h-[32rem]'
      />
    </PlatformResourceSection>
  )
}
