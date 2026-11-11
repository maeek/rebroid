'use client'

import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import { DetailFields } from '@/shared/ui/detail-fields'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import { appendDockerMetricsHistory, type HistorySample } from './docker-metrics-history'
import type { DockerMetricsSnapshot } from '@/shared/contracts/diagnostics'

const summaryCards = (metrics: DockerMetricsSnapshot | null) =>
  [
    ['Success', metrics?.totals.success, 'Completed Docker operations', 'success'],
    ['Errors', metrics?.totals.errors, 'Failed Docker operations', 'danger'],
    ['Timeouts', metrics?.totals.timeouts, 'Operations that exceeded timeout', 'warning'],
    ['Retries', metrics?.totals.retries, 'Retry attempts across operations', 'primary'],
    ['Slow operations', metrics?.totals.slow, 'Exceeded the slow-operation warning', 'neutral']
  ] as const

const loadDockerMetrics = () => getBff<DockerMetricsSnapshot>('/api/bff/platform/docker-metrics')

export function DockerMetricsDashboard({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: () => void
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
      void mutate().finally(() => onRefreshComplete?.())
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
  if (error || !data) {
    return (
      <Notice
        tone='danger'
        title='Docker metrics unavailable'
        description='The orchestrator metrics snapshot could not be loaded.'
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
    )
  }

  return (
    <DockerMetricsContent
      data={data}
      history={history}
    />
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
      className='flex w-full flex-col gap-6'
      aria-busy={loading}
    >
      <Section
        surface='panel'
        title='Connection'
      >
        <DetailFields
          loading={loading}
          fields={[
            { label: 'Transport', value: data?.transport },
            {
              label: 'Remote request timeout',
              value: data ? `${data.limits.remoteRequestTimeoutMs.toLocaleString()} ms` : null
            }
          ]}
        />
      </Section>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
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
      <div className='grid gap-6 xl:grid-cols-2'>
        <MetricsChart
          loading={loading}
          title='In-flight and queued operations'
          data={history}
          keys={['read', 'mutation', 'long', 'queued']}
        />
        <MetricsChart
          loading={loading}
          title='Retries, errors, and slow operations'
          data={history}
          keys={['retries', 'errors', 'slow']}
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
                <TableHead>Retries</TableHead>
                <TableHead>Slow</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <MetricsTableSkeleton columns={8} />
              ) : (
                data?.operations.map(operation => (
                  <TableRow key={`${operation.class}:${operation.operation}`}>
                    <TableCell>{operation.class}</TableCell>
                    <TableCell>{operation.operation}</TableCell>
                    <TableCell>{operation.success}</TableCell>
                    <TableCell>{operation.errors + operation.timeouts}</TableCell>
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
      <Section
        surface='panel'
        title='Recent slow or failed operations'
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
                      <TableCell>{event.outcome}</TableCell>
                      <TableCell>{event.durationMs}ms</TableCell>
                      <TableCell>{event.error ?? '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Visible>
      </Section>
    </section>
  )
}

const colors = ['#2563eb', '#9333ea', '#059669', '#d97706']

function MetricsChart({
  title,
  data,
  keys,
  loading = false
}: {
  title: string
  data: HistorySample[]
  keys: (keyof HistorySample)[]
  loading?: boolean
}) {
  return (
    <Section
      title={title}
      surface='panel'
      className='min-w-0'
    >
      <div className='h-72'>
        {loading ? (
          <Skeleton className='size-full' />
        ) : (
          <ChartContainer
            config={{}}
            className='h-full w-full'
          >
            <AreaChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='timestamp'
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {keys.map((key, index) => (
                <Area
                  key={key}
                  dataKey={key}
                  type='monotone'
                  stroke={colors[index]}
                  fill={colors[index]}
                  fillOpacity={0.15}
                />
              ))}
            </AreaChart>
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
