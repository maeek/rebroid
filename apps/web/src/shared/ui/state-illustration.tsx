'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import styles from './state-illustration.module.css'

export type StateArtwork =
  | 'accounts'
  | 'activity'
  | 'build'
  | 'error'
  | 'external-devices'
  | 'files'
  | 'inventory'
  | 'models'
  | 'network'
  | 'package'
  | 'search'
  | 'trigger'
  | 'unavailable'
  | 'workflow'

const widths = {
  page: 'w-72 sm:w-[23rem]',
  panel: 'w-36 sm:w-44',
  inline: 'w-20 sm:w-24'
}

// Align the main object with the heading. Cables, plugs and secondary tools
// extend the silhouette without carrying the same visual weight.
const opticalOffsets: Partial<Record<StateArtwork, string>> = {
  build: 'translate-x-[3%]',
  'external-devices': 'translate-x-[3%]',
  models: 'translate-x-[5%]',
  network: '-translate-x-[4%]',
  trigger: 'translate-x-[2%]',
  unavailable: 'translate-x-[8%]',
  workflow: '-translate-x-[4%]'
}

// Bounds of the rendered lens, as percentages of its transparent canvas.
const indicatorBounds: Partial<Record<StateArtwork, [number, number, number, number]>> = {
  accounts: [79.52, 42.98, 2.23, 4.04],
  'external-devices': [79.62, 47.88, 1.94, 3.39],
  files: [70.06, 51.39, 2.75, 4.69],
  inventory: [70.14, 60.07, 2.31, 4.3],
  models: [44.01, 24.27, 1.94, 3.26],
  network: [75.6, 36.26, 2.01, 3.39],
  package: [68.75, 48.05, 2.01, 3.52],
  search: [65.53, 70.85, 2.16, 3.52],
  unavailable: [57.22, 33.08, 2.16, 3.78],
  workflow: [79.38, 17.21, 1.94, 3.26]
}

export const StateIllustration = ({
  kind,
  size,
  align = 'center'
}: {
  kind: StateArtwork
  size: keyof typeof widths
  align?: 'center' | 'start'
}) => {
  const indicator = indicatorBounds[kind]

  return (
    <span
      key={`${kind}-${size}`}
      data-slot='state-illustration'
      aria-hidden='true'
      className={cn(
        styles.artwork,
        'relative isolate block max-w-full',
        widths[size],
        align === 'center' && opticalOffsets[kind]
      )}
    >
      <picture className='block'>
        {size === 'page' && (
          <source
            type='image/avif'
            media='(min-resolution: 1.25dppx)'
            srcSet={`/illustrations/${kind}.avif`}
          />
        )}
        <Image
          src={`/illustrations/${kind}.webp`}
          alt=''
          width={392}
          height={224}
          unoptimized
          loading={size === 'page' ? 'eager' : 'lazy'}
          onLoad={event => {
            event.currentTarget.dataset.decoded = 'true'
          }}
          className='block h-auto w-full'
        />
      </picture>
      {indicator && (
        <span
          className='pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary mix-blend-color'
          style={{
            left: `${indicator[0]}%`,
            top: `${indicator[1]}%`,
            width: `${indicator[2]}%`,
            height: `${indicator[3]}%`
          }}
        />
      )}
    </span>
  )
}
