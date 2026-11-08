'use client'

import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { formatDisplayNumber } from '@/lib/format'

export function MemoryChart({ totalMemory, freeMemory }: { totalMemory: number; freeMemory: number }) {
  const memory = totalMemory > 0 ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0
  const chartData = [{ memory, fill: 'var(--color-mem_usage)' }]

  return (
    <ChartContainer
      config={{
        memory: {
          label: 'Memory'
        },
        mem_usage: {
          label: 'Memory usage',
          color: memory > 75 ? 'var(--color-chart-3)' : 'var(--color-chart-2)'
        }
      }}
      className='mx-auto aspect-square w-full max-w-85'
    >
      <RadialBarChart
        data={chartData}
        startAngle={90}
        endAngle={90 - memory * 3.6}
        cx='50%'
        cy='50%'
        innerRadius='72%'
        outerRadius='96%'
      >
        <RadialBar
          dataKey='memory'
          isAnimationActive={false}
          background
          cornerRadius={10}
        />
        <PolarRadiusAxis
          tick={false}
          tickLine={false}
          axisLine={false}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor='middle'
                    dominantBaseline='middle'
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 8}
                      className='fill-foreground text-5xl font-bold'
                    >
                      {formatDisplayNumber(chartData[0].memory)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 26}
                      className='fill-foreground-muted'
                    >
                      % Memory used
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  )
}
