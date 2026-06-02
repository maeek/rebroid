'use client'

import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getDockerMetricsAction } from '@/server/orchestrator/diagnostics/actions'
import { appendDockerMetricsHistory, type HistorySample } from './docker-metrics-history'
import type { DockerMetricsSnapshot } from '@/server/orchestrator/diagnostics/types'

const summaryCards = (metrics: DockerMetricsSnapshot) =>
  [
    ['Success', metrics.totals.success],
    ['Errors', metrics.totals.errors],
    ['Timeouts', metrics.totals.timeouts],
    ['Retries', metrics.totals.retries],
    ['Slow operations', metrics.totals.slow]
  ] as const

export function DockerMetricsDashboard() {
  const [history, setHistory] = useState<HistorySample[]>([])
  const { data, error, isLoading } = usePollingQuery<DockerMetricsSnapshot>(
    'orchestrator:docker-metrics',
    getDockerMetricsAction,
    { intervalMs: 5000 }
  )

  useEffect(() => {
    if (!data) return
    setHistory(current => appendDockerMetricsHistory(current, data))
  }, [data])

  if (isLoading) return <section className='px-6 pb-16 max-sm:px-4'>Loading Docker metrics...</section>
  if (error || !data) {
    return (
      <section className='px-6 pb-16 max-sm:px-4'>
        <StatusSplash
          title='Docker metrics unavailable'
          description='The orchestrator metrics snapshot could not be loaded.'
          detail={getDisplayErrorMessage(error, 'Unknown metrics error')}
          tone='danger'
          className='min-h-64'
        />
      </section>
    )
  }

  return (
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        {summaryCards(data).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm text-secondary-foreground'>{label}</CardTitle>
            </CardHeader>
            <CardContent className='text-3xl font-semibold'>{value}</CardContent>
          </Card>
        ))}
      </div>
      <Section
        title='Docker access policy'
        boxed
        contentClassName='gap-2 text-sm'
      >
        <p>
          Transport: <strong>{data.transport}</strong>
        </p>
        <p>
          Limits: {data.limits.maxConcurrentReads} reads, {data.limits.maxConcurrentLongOperations} long operations
        </p>
        <p>
          Slow warning: {data.limits.slowRequestWarningMs}ms. Long-operation timeout:{' '}
          {data.limits.longOperationTimeoutMs}ms.
        </p>
      </Section>
      <div className='grid gap-6 xl:grid-cols-2'>
        <MetricsChart
          title='In-flight and queued operations'
          data={history}
          keys={['read', 'mutation', 'long', 'queued']}
        />
        <MetricsChart
          title='Retries, errors, and slow operations'
          data={history}
          keys={['retries', 'errors', 'slow']}
        />
      </div>
      <Section
        title='Per-operation aggregates'
        boxed
      >
        <Table>
          <TableHeader>
            <TableRow>
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
            {data.operations.map(operation => (
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
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section
        title='Recent slow or failed operations'
        boxed
      >
        <Visible when={data.events.length === 0}>
          <p className='text-sm text-secondary-foreground'>No slow or failed Docker operations recorded.</p>
        </Visible>
        <Visible when={data.events.length > 0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((event, index) => (
                <TableRow key={`${event.timestamp}:${event.operation}:${index}`}>
                  <TableCell>{new Date(event.timestamp).toLocaleTimeString()}</TableCell>
                  <TableCell>{event.class}</TableCell>
                  <TableCell>{event.operation}</TableCell>
                  <TableCell>{event.outcome}</TableCell>
                  <TableCell>{event.durationMs}ms</TableCell>
                  <TableCell>{event.error ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Visible>
      </Section>
    </section>
  )
}

const colors = ['#2563eb', '#9333ea', '#059669', '#d97706']

function MetricsChart({ title, data, keys }: { title: string; data: HistorySample[]; keys: (keyof HistorySample)[] }) {
  return (
    <Section
      title={title}
      boxed
      className='min-w-0'
    >
      <div className='h-72'>
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
      </div>
    </Section>
  )
}
