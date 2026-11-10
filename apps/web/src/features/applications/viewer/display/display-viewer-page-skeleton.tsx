'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { DisplayViewerLayout } from './display-viewer-shell/display-viewer-layout'
import { SurfaceTabs } from './display-viewer-shell/surface/surface-tabs'

const noop = () => undefined

export const DisplayViewerPageSkeleton = () => (
  <DisplayViewerLayout
    tabs={
      <SurfaceTabs
        loading
        surfaces={[]}
        isAddingDisplay={false}
        onAddDisplay={noop}
        onSelectSurface={noop}
        onScrollSurfaceIntoView={noop}
      />
    }
  >
    <div className='flex min-w-0 items-start gap-2'>
      <div className='flex w-[min(calc(100vw-var(--viewer-rail-width)-1.5rem),calc((100svh-var(--viewer-chrome-height)-1rem)*9/16))] flex-col overflow-hidden rounded-panel'>
        <Skeleton className='h-[var(--viewer-chrome-height)] w-full rounded-b-none' />
        <Skeleton className='aspect-[9/16] w-full rounded-t-none' />
      </div>
      <div className='grid w-[var(--viewer-rail-width)] gap-1.5'>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            key={index}
            className='size-[var(--viewer-rail-width)]'
          />
        ))}
      </div>
    </div>
  </DisplayViewerLayout>
)
