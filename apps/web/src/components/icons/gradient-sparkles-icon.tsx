'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export const GradientSparklesIcon = ({ className }: { className?: string }) => {
  const gradientId = useId().replaceAll(':', '')

  return (
    <svg
      viewBox='0 0 24 24'
      width='24'
      height='24'
      fill='none'
      strokeWidth='1.9'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('h-6 w-6', className)}
      aria-hidden='true'
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1='4'
          y1='20'
          x2='20'
          y2='4'
          gradientUnits='userSpaceOnUse'
        >
          <stop
            offset='0%'
            stopColor='#22d3ee'
          />
          <stop
            offset='42%'
            stopColor='#38bdf8'
          />
          <stop
            offset='100%'
            stopColor='#a78bfa'
          />
        </linearGradient>
      </defs>
      <g style={{ stroke: `url(#${gradientId})` }}>
        <path d='M12 3.1l1.55 4.98a3.16 3.16 0 0 0 2.08 2.08L20.6 12l-4.97 1.84a3.16 3.16 0 0 0-2.08 2.08L12 20.9l-1.55-4.98a3.16 3.16 0 0 0-2.08-2.08L3.4 12l4.97-1.84a3.16 3.16 0 0 0 2.08-2.08L12 3.1z' />
        <path
          d='M9.65 14.6h4.7'
          opacity='0.74'
        />
      </g>
      <g
        fill={`url(#${gradientId})`}
        stroke='none'
      >
        <circle
          cx='10.35'
          cy='11.95'
          r='0.85'
        />
        <circle
          cx='13.65'
          cy='11.95'
          r='0.85'
        />
      </g>
    </svg>
  )
}
