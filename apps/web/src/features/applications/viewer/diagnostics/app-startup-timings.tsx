'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { formatDateLocale } from '@/lib/format'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/actions/runtime/log-actions'
import { DetailFields } from '@/shared/ui/detail-fields'
import { StateView } from '@/shared/ui/state-view'
import { readStartupTimings, startupElapsed } from './startup-timings'
import type { StartupTimings } from './startup-timings'
import type { ViewerStartupDurations } from './use-startup-first-frame'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationLog } from '@/shared/contracts/application'

export const AppStartupTimings = ({
  app,
  firstFrameAt,
  viewerStartup
}: {
  app: AppDefinition
  firstFrameAt?: number
  viewerStartup?: ViewerStartupDurations
}) => {
  const { data, error, isLoading, isValidating, mutate } = usePollingQuery<ApplicationLog>(
    ['applications', app.id, 'logs', 'orchestrator'],
    () => getApplicationLogsAction(app.id, 'orchestrator', 500),
    { revalidateOnMount: false }
  )
  const observation = JSON.stringify([app.id, app.containerId, app.lifecycleStage, firstFrameAt])
  const previousObservation = useRef(observation)
  // Follow existing lifecycle updates, without a second polling timer.
  useEffect(() => {
    if (previousObservation.current === observation) return
    previousObservation.current = observation
    void mutate()
  }, [observation, mutate])
  const timings = useMemo(() => readStartupTimings(app, data?.output, firstFrameAt), [app, data?.output, firstFrameAt])
  return (
    <AppStartupTimingsSection
      timings={timings}
      viewerStartup={viewerStartup}
      loading={isLoading}
      error={Boolean(error)}
      action={
        <MutationButton
          variant='ghost'
          size='sm'
          pending={isValidating}
          pendingLabel='Refreshing…'
          onClick={() => void mutate()}
        >
          Refresh timings
        </MutationButton>
      }
    />
  )
}

const loadingFields = Array.from({ length: 6 }, (_, index) => ({ label: String(index), value: null }))

export const AppStartupTimingsSection = ({
  timings,
  viewerStartup,
  loading = false,
  error = false,
  action
}: {
  timings?: StartupTimings
  viewerStartup?: ViewerStartupDurations
  loading?: boolean
  error?: boolean
  action?: React.ReactNode
}) => {
  const baseline = timings?.baseline ?? null
  const fields = (timings?.milestones ?? []).map(({ label, at }) => {
    const date = new Date(at)
    const timestamp = date.toISOString()
    const localTimestamp = formatDateLocale(date)
    return {
      label,
      copyValue: timestamp,
      value: (
        <time
          dateTime={timestamp}
          title={localTimestamp}
        >
          {baseline !== null && at >= baseline ? `+${startupElapsed(at - baseline)}` : localTimestamp}
        </time>
      )
    }
  })
  const viewerFields =
    viewerStartup && timings && timings.firstFrameAt !== null
      ? [
          {
            label: 'Viewer session request to stream request',
            value: startupElapsed(viewerStartup.requestToConnectMs)
          },
          { label: 'Stream request to first frame', value: startupElapsed(viewerStartup.connectToFrameMs) }
        ]
      : []
  return (
    <Section
      title='Startup timings'
      surface='plain'
      className={editorSectionClassName}
      contentClassName='gap-3'
      actions={action}
      description='Elapsed times start at container creation or start. The first frame includes any wait before opening the viewer.'
    >
      {error ? (
        <Notice
          tone='warning'
          title='Startup timings unavailable'
          description='Refresh to try reading lifecycle events again.'
        />
      ) : null}
      {loading || fields.length > 0 ? (
        <DetailFields
          compact
          layout='list'
          loading={loading}
          fields={loading ? loadingFields : [...fields, ...viewerFields]}
        />
      ) : !error ? (
        <StateView
          kind='empty'
          title='No startup events recorded'
          description='No milestones are available for this startup.'
        />
      ) : null}
    </Section>
  )
}
