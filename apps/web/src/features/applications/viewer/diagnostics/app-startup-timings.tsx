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
import { readStartupTimings, startupElapsed } from './startup-timings'
import type { StartupTimings } from './startup-timings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationLog } from '@/shared/contracts/application'

export const AppStartupTimings = ({ app, firstFrameAt }: { app: AppDefinition; firstFrameAt?: number }) => {
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

export const AppStartupTimingsSection = ({
  timings,
  loading = false,
  error = false,
  action
}: {
  timings?: StartupTimings
  loading?: boolean
  error?: boolean
  action?: React.ReactNode
}) => {
  const total =
    timings?.baseline !== null && timings?.baseline !== undefined && timings.firstFrameAt !== null
      ? startupElapsed(timings.firstFrameAt - timings.baseline)
      : 'Not recorded yet'
  const placeholders = [
    { label: 'Container creation started', at: null },
    { label: 'Container started', at: null },
    { label: 'Android ready', at: null },
    { label: 'ADB ready', at: null },
    { label: 'App ready', at: null },
    { label: 'First frame in this tab', at: null }
  ]
  const milestones = loading ? placeholders : (timings?.milestones ?? placeholders)
  return (
    <Section
      title='Startup timings'
      surface='plain'
      className={editorSectionClassName}
      actions={action}
      description='Latest startup, through the first frame seen in this tab. Includes any wait before opening the viewer.'
    >
      {error ? (
        <Notice
          tone='warning'
          title='Startup timings unavailable'
          description='Refresh to try reading lifecycle events again.'
        />
      ) : null}
      <DetailFields
        loading={loading}
        fields={[
          { label: 'Startup to first frame', value: total, fullWidth: true },
          ...milestones.map(({ label, at }) => ({
            label,
            copyValue: at === null ? undefined : new Date(at).toISOString(),
            value:
              at === null ? (
                'Not recorded yet'
              ) : (
                <span>
                  <time dateTime={new Date(at).toISOString()}>{formatDateLocale(new Date(at))}</time>
                  {timings?.baseline !== null && timings?.baseline !== undefined && at >= timings.baseline ? (
                    <span className='ml-2 text-foreground-muted'>+{startupElapsed(at - timings.baseline)}</span>
                  ) : null}
                </span>
              )
          }))
        ]}
      />
      {!loading && !error && !timings?.baseline ? (
        <p className='text-sm text-foreground-muted'>Creation or start events are not available in the retained log.</p>
      ) : null}
    </Section>
  )
}
