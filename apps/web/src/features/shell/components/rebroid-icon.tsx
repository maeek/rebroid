import { useId } from 'react'

export function RebroidIcon() {
  const id = useId()
  const tileId = `${id}-tile`
  const clipId = `${id}-clip`
  const silhouette = 'color-mix(in oklab, currentColor 18%, black)'

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 512 512'
      className='size-6 shrink-0 text-primary'
    >
      <defs>
        <linearGradient
          id={tileId}
          x1='76'
          y1='64'
          x2='438'
          y2='438'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='color-mix(in oklab, currentColor 68%, white)' />
          <stop
            offset='.58'
            stopColor='currentColor'
          />
          <stop
            offset='1'
            stopColor='color-mix(in oklab, currentColor 88%, black)'
          />
        </linearGradient>
        <clipPath id={clipId}>
          <path d='M156 40h200c76 0 116 40 116 116v200c0 76-40 116-116 116H156c-76 0-116-40-116-116V156C40 80 80 40 156 40Z' />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect
          width='512'
          height='512'
          fill={`url(#${tileId})`}
        />
        <circle
          cx='146'
          cy='126'
          r='24'
          fill='white'
          opacity='.9'
        />
        <circle
          cx='202'
          cy='126'
          r='24'
          fill='white'
          opacity='.56'
        />

        <path
          d='M192 346 160 294M320 346 352 294'
          stroke={silhouette}
          strokeWidth='24'
          strokeLinecap='round'
        />
        <path
          d='M108 512c8-112 70-176 148-176s140 64 148 176H108Z'
          fill={silhouette}
        />
        <circle
          cx='186'
          cy='418'
          r='13'
          fill='currentColor'
        />
        <circle
          cx='326'
          cy='418'
          r='13'
          fill='currentColor'
        />
      </g>
    </svg>
  )
}
