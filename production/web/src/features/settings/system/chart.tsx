'use client'

import { CartesianGrid, XAxis, Area, AreaChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { formatUtcTime } from '@/lib/format'

const chartConfig = {
  cpu: {
    label: 'CPU Usage',
    color: '#2563eb'
  },
  time: {
    label: 'Time'
  }
}

export const SystemChart = ({ cpuData }: { cpuData?: [string, number][] }) => {
  if (!cpuData) return null

  const chartData = cpuData.map(([time, cpu]) => ({
    time: formatUtcTime(time),
    cpu
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className='h-full w-full pb-3'
    >
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey='time'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={value => `${value as string}%`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey='cpu'
          type='monotone'
          stroke={`var(--color-cpu)`}
          fill={`var(--color-cpu)`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
