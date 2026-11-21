'use client'

import { useEffect, useState } from 'react'
import { Notice } from '@/components/ui/notice'
import { getPlatformContainerLogsAction } from '@/server/orchestrator/platform/container-actions'
import { actionError, type ActionError, type ActionResult } from '@/shared/actions/action-result'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { PlatformContainerLog } from '@/shared/contracts/platform'

export const ContainerLogsSection = ({
  containerId,
  pendingLogs
}: {
  containerId: string
  pendingLogs?: Promise<ActionResult<PlatformContainerLog>>
}) => {
  const [refreshRequest, setRefreshRequest] = useState<{
    initial: typeof pendingLogs
    result: Promise<ActionResult<PlatformContainerLog>>
  }>()
  const [logs, setLogs] = useState<PlatformContainerLog>()
  const [settled, setSettled] = useState<{
    request: Promise<ActionResult<PlatformContainerLog>>
    error?: ActionError
  }>()
  const request = refreshRequest?.initial === pendingLogs ? (refreshRequest?.result ?? pendingLogs) : pendingLogs

  useEffect(() => {
    if (!request) return
    let active = true
    const complete = (result: ActionResult<PlatformContainerLog>) => {
      if (!active) return
      if (result.ok) setLogs(result.data)
      setSettled({ request, error: result.ok ? undefined : result.error })
    }
    void request.then(complete, () => complete(actionError({ message: 'Could not load container logs.' })))
    return () => {
      active = false
    }
  }, [request])

  const pending = Boolean(request && settled?.request !== request)
  const failure = settled?.request === request ? settled?.error : undefined

  return (
    <ContainerLogsContent
      logs={logs}
      failure={failure}
      loading={pending && !logs}
      isRefreshingLogs={pending}
      refreshLogs={() => {
        if (!pending) setRefreshRequest({ initial: pendingLogs, result: getPlatformContainerLogsAction(containerId) })
      }}
    />
  )
}

export const ContainerLogsContent = ({
  logs,
  failure,
  isRefreshingLogs = false,
  refreshLogs,
  loading = false
}: {
  logs?: { collectedAt: string; output: string }
  failure?: ActionError
  isRefreshingLogs?: boolean
  refreshLogs?: () => void
  loading?: boolean
}) => {
  return (
    <PlatformResourceSection
      title='Logs'
      surface='plain'
      className='lg:flex-1'
      contentClassName='gap-4 lg:flex-1'
    >
      {failure ? (
        <Notice
          tone='warning'
          title={failure.status === 413 ? 'Container log tail exceeds the read limit' : 'Could not load container logs'}
          description={
            logs ? 'Showing the last collected log tail. Use Refresh to try again.' : 'Use Refresh to try again.'
          }
        >
          {failure.requestId !== 'local' ? <p>Request ID {failure.requestId}</p> : null}
        </Notice>
      ) : null}
      <LogsConsole
        loading={loading}
        log={logs}
        isRefreshing={isRefreshingLogs}
        onRefresh={refreshLogs}
        emptyMessage={failure ? 'Log output is unavailable.' : 'No logs returned for this container.'}
        collectedAtPrefix='Recent Docker logs collected at'
        formatCollectedAt={formatPlatformDate}
        controls={<p className='text-sm text-foreground-muted'>Recent Docker logs for this container.</p>}
        className='lg:flex-1 lg:grid-rows-[auto_minmax(12rem,1fr)_auto]'
        outputClassName='max-lg:h-[40dvh] max-lg:min-h-80 max-lg:max-h-[32rem] lg:[contain:size]'
      />
    </PlatformResourceSection>
  )
}
