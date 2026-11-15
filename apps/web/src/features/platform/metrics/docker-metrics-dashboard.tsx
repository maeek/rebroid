'use client'

import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ResourceLink } from '@/shared/ui/resource-link'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import { appendDockerMetricsHistory, type HistorySample } from './docker-metrics-history'
import type { DockerMetricsSnapshot } from '@/shared/contracts/diagnostics'

const summaryCards = (metrics: DockerMetricsSnapshot | null) =>
  [
    ['Success', metrics?.totals.success, 'Completed Docker operations', 'success'],
    ['Errors', metrics?.totals.errors, 'Failures excluding timeouts', 'danger'],
    ['Timeouts', metrics?.totals.timeouts, 'Operations that exceeded their deadline', 'warning'],
    ['Retries', metrics?.totals.retries, 'Retry attempts across operations', 'primary'],
    ['Slow operations', metrics?.totals.slow, 'Exceeded the slow-operation warning', 'neutral']
  ] as const

const loadDockerMetrics = () => getBff<DockerMetricsSnapshot>('/api/bff/platform/docker-metrics')

export function DockerMetricsDashboard({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: (succeeded: boolean) => void
} = {}) {
  const [history, setHistory] = useState<HistorySample[]>([])
  const lastRefreshKey = useRef(refreshKey)
  const { data, error, isLoading, isValidating, mutate } = usePollingQuery<DockerMetricsSnapshot>(
    'orchestrator:docker-metrics',
    loadDockerMetrics,
    { intervalMs: 5000 }
  )

  useEffect(() => {
    if (refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey
      void mutate(undefined, { throwOnError: true }).then(
        () => onRefreshComplete?.(true),
        () => onRefreshComplete?.(false)
      )
    }
  }, [mutate, onRefreshComplete, refreshKey])

  useEffect(() => {
    if (!data) return
    setHistory(current => appendDockerMetricsHistory(current, data))
  }, [data])

  if (isLoading)
    return (
      <DockerMetricsContent
        data={null}
        history={history}
        loading
      />
    )
  const refreshNotice =
    error || !data ? (
      <Notice
        tone={data ? 'warning' : 'danger'}
        title={data ? 'Docker metrics could not be refreshed' : 'Docker metrics unavailable'}
        description={
          data ? 'Showing the last successful snapshot.' : 'The orchestrator metrics snapshot could not be loaded.'
        }
        actions={
          <MutationButton
            type='button'
            variant='ghost'
            pending={isValidating}
            pendingLabel='Retrying…'
            onClick={() => void mutate()}
          >
            Try again
          </MutationButton>
        }
      />
    ) : null

  return data ? (
    <div className='flex min-w-0 flex-col gap-4'>
      {refreshNotice}
      <DockerMetricsContent
        data={data}
        history={history}
      />
    </div>
  ) : (
    refreshNotice
  )
}

export const DockerMetricsContent = ({
  data,
  history,
  loading = false
}: {
  data: DockerMetricsSnapshot | null
  history: HistorySample[]
  loading?: boolean
}) => {
  return (
    <section
      className='flex w-full min-w-0 flex-col gap-6'
      aria-busy={loading}
    >
      {data ? (
        <p className='flex flex-wrap items-center gap-x-1 text-xs text-foreground-muted'>
          Snapshot taken{' '}
          <DateTimeValue
            value={data.collectedAt}
            compact
            showSeconds
          />
        </p>
      ) : (
        <Skeleton className='h-4 w-48' />
      )}
      <RecentDockerOperations
        data={data}
        loading={loading}
      />
      <Section
        surface='panel'
        title='Connection'
        actions={
          loading ? undefined : (
            <ResourceLink
              href='/runtime/containers'
              className='text-sm'
            >
              Browse Docker containers
            </ResourceLink>
          )
        }
      >
        <DetailFields
          loading={loading}
          fields={[
            { label: 'Transport', value: data?.transport },
            {
              label: 'Remote request timeout',
              value: data ? `${data.limits.remoteRequestTimeoutMs.toLocaleString()} ms` : null
            },
            ...(loading || data?.transport === 'local-socket'
              ? [{ label: 'Socket path', value: data?.socketPath, code: true, fullWidth: true }]
              : [])
          ]}
        />
      </Section>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        {summaryCards(data).map(([label, value, hint, tone]) => (
          <QuickGlanceCard
            key={label}
            label={label}
            value={value}
            loading={loading}
            hint={hint}
            tone={tone}
          />
        ))}
      </div>
      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        <MetricsChart
          loading={loading}
          title='In-flight and queued operations'
          description='Number of operations at each sample.'
          data={history}
          keys={['read', 'mutation', 'long', 'queued']}
        />
        <MetricsChart
          loading={loading}
          title='Operation events between samples'
          description='Number recorded since the preceding sample. Gaps mark a missing baseline or a counter reset.'
          data={history}
          keys={['errors', 'timeouts', 'retries', 'slow']}
          intervalCounts
        />
      </div>
      <Section
        surface='panel'
        title='Per-operation aggregates'
        headingSpacing='default'
        contentClassName='gap-4'
      >
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader className='bg-surface-band/55'>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Class</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Timeouts</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Slow</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <MetricsTableSkeleton columns={9} />
              ) : (
                data?.operations.map(operation => (
                  <TableRow key={`${operation.class}:${operation.operation}`}>
                    <TableCell>{operation.class}</TableCell>
                    <TableCell>{operation.operation}</TableCell>
                    <TableCell>{operation.success}</TableCell>
                    <TableCell>{operation.errors}</TableCell>
                    <TableCell>{operation.timeouts}</TableCell>
                    <TableCell>{operation.retries}</TableCell>
                    <TableCell>{operation.slow}</TableCell>
                    <TableCell>{operation.averageDurationMs}ms</TableCell>
                    <TableCell>{operation.maxDurationMs}ms</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>
    </section>
  )
}

const RecentDockerOperations = ({ data, loading }: { data: DockerMetricsSnapshot | null; loading: boolean }) => (
  <Section
    surface='panel'
    title='Recent failures, timeouts, and slow operations'
    headingSpacing='default'
    contentClassName='gap-4'
  >
    <Visible when={!loading && data?.events.length === 0}>
      <p className='text-sm text-foreground-muted'>No slow or failed Docker operations recorded.</p>
    </Visible>
    <Visible when={loading || (data?.events.length ?? 0) > 0}>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader className='bg-surface-band/55'>
            <TableRow className='hover:bg-transparent'>
              <TableHead>Time</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <MetricsTableSkeleton columns={6} />
            ) : (
              data?.events.map((event, index) => (
                <TableRow key={`${event.timestamp}:${event.operation}:${index}`}>
                  <TableCell>{new Date(event.timestamp).toLocaleTimeString()}</TableCell>
                  <TableCell>{event.class}</TableCell>
                  <TableCell>{event.operation}</TableCell>
                  <TableCell>
                    {event.outcome === 'error' ? 'Error' : event.outcome === 'timeout' ? 'Timeout' : 'Slow'}
                  </TableCell>
                  <TableCell>{event.durationMs}ms</TableCell>
                  <TableCell className='min-w-48 [overflow-wrap:anywhere]'>{event.error ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Visible>
  </Section>
)

const chartSeries = {
  read: { label: 'Reads', color: 'var(--color-chart-1)', dash: undefined },
  mutation: { label: 'Mutations', color: 'var(--color-chart-2)', dash: '6 3' },
  long: { label: 'Long operations', color: 'var(--color-chart-4)', dash: '2 3' },
  queued: { label: 'Queued', color: 'var(--color-foreground-muted)', dash: '8 3 2 3' },
  errors: { label: 'Errors', color: 'var(--color-danger)', dash: undefined },
  timeouts: { label: 'Timeouts', color: 'var(--color-warning)', dash: '6 3' },
  retries: { label: 'Retries', color: 'var(--color-chart-1)', dash: '2 3' },
  slow: { label: 'Slow operations', color: 'var(--color-chart-4)', dash: '8 3 2 3' }
}

function MetricsChart({
  title,
  description,
  data,
  keys,
  loading = false,
  intervalCounts = false
}: {
  title: string
  description: string
  data: HistorySample[]
  keys: (keyof typeof chartSeries)[]
  loading?: boolean
  intervalCounts?: boolean
}) {
  return (
    <Section
      title={title}
      description={description}
      surface='panel'
      className='min-w-0'
    >
      <div className='h-72'>
        {loading ? (
          <Skeleton className='size-full' />
        ) : (intervalCounts ? data.length < 2 : !data.length) ? (
          <p className='text-sm text-foreground-muted'>Collecting samples…</p>
        ) : (
          <ChartContainer
            config={chartSeries}
            className='aspect-auto h-full w-full min-w-0'
          >
            <LineChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='timestamp'
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <ChartLegend content={<ChartLegendContent className='flex-wrap gap-x-4 gap-y-1' />} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {keys.map(key => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  strokeDasharray={chartSeries[key].dash}
                  isAnimationActive={false}
                  dot={{ r: 2, fill: `var(--color-${key})` }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </Section>
  )
}

const MetricsTableSkeleton = ({ columns }: { columns: number }) => (
  <>
    {Array.from({ length: 4 }, (_, row) => (
      <TableRow key={row}>
        {Array.from({ length: columns }, (cell, column) => (
          <TableCell key={column}>
            <Skeleton className='h-4 w-20 max-w-full' />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
)
