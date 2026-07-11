'use client'

import { IconTerminal2 } from '@tabler/icons-react'
import { Section } from '@/components/ui/section'
import { useContainerDetailControllerContext } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'

export const ContainerLogsSection = () => {
  const { isRefreshingLogs, logs, refreshLogs } = useContainerDetailControllerContext()

  return (
    <Section
      title={
        <div className='flex items-center gap-2'>
          <IconTerminal2 className='size-5' />
          Logs
        </div>
      }
      surface='panel'
      contentClassName='gap-4'
    >
      <LogsConsole
        log={logs}
        isRefreshing={isRefreshingLogs}
        onRefresh={() => void refreshLogs()}
        emptyMessage='No logs returned for this container.'
        collectedAtPrefix='Recent Docker logs collected at'
        formatCollectedAt={formatPlatformDate}
        controls={<p className='text-sm text-foreground-muted'>Recent Docker logs for this container.</p>}
        outputClassName='max-h-128 rounded-panel bg-black/35 leading-6'
      />
    </Section>
  )
}
