'use client'

import { IconTerminal2 } from '@tabler/icons-react'
import { Section } from '@/components/ui/section'
import { formatPlatformDate } from '@/features/orchestrator/components/platform-detail-parts'
import { LogsConsole } from '@/features/orchestrator/logs/logs-console'
import type { PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const ContainerLogsSection = ({
  logs,
  isRefreshingLogs,
  onRefresh
}: {
  logs: PlatformContainerLog
  isRefreshingLogs: boolean
  onRefresh: () => void
}) => (
  <Section
    title={
      <div className='flex items-center gap-2'>
        <IconTerminal2 className='size-5' />
        Logs
      </div>
    }
    boxed
    contentClassName='gap-4'
  >
    <LogsConsole
      log={logs}
      isRefreshing={isRefreshingLogs}
      onRefresh={onRefresh}
      emptyMessage='No logs returned for this container.'
      collectedAtPrefix='Recent Docker logs collected at'
      formatCollectedAt={formatPlatformDate}
      controls={<p className='text-sm text-secondary-foreground'>Recent Docker logs for this container.</p>}
      outputClassName='max-h-128 rounded-lg bg-black/35 leading-6'
    />
  </Section>
)
