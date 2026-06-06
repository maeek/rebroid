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
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('h-6 w-6', className)}
      aria-hidden='true'
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1='0%'
          y1='100%'
          x2='100%'
          y2='0%'
          gradientUnits='objectBoundingBox'
        >
          <stop
            offset='0%'
            stopColor='#22d3ee'
          />
          <stop
            offset='45%'
            stopColor='#38bdf8'
          />
          <stop
            offset='100%'
            stopColor='#a78bfa'
          />
        </linearGradient>
      </defs>
      <g style={{ stroke: `url(#${gradientId})` }}>
        <path d='M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z' />
        <path d='M5 3v4' />
        <path d='M19 17v4' />
        <path d='M3 5h4' />
        <path d='M17 19h4' />
      </g>
    </svg>
  )
}
