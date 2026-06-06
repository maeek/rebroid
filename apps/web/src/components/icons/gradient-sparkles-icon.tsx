'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export const GradientSparklesIcon = ({ className }: { className?: string }) => {
  const gradientId = useId().replaceAll(':', '')

  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke={`url(#${gradientId})`}
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('stroke-current', className)}
      aria-hidden='true'
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1='3'
          y1='21'
          x2='21'
          y2='3'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='#22d3ee' />
          <stop
            offset='0.45'
            stopColor='#38bdf8'
          />
          <stop
            offset='1'
            stopColor='#a78bfa'
          />
        </linearGradient>
      </defs>
      <path d='M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z' />
      <path d='M5 3v4' />
      <path d='M19 17v4' />
      <path d='M3 5h4' />
      <path d='M17 19h4' />
    </svg>
  )
}
