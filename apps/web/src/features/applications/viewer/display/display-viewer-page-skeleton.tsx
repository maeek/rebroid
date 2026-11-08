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
    controls={
      <div className='flex items-center justify-center gap-2'>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            key={index}
            className='size-8 rounded-full'
          />
        ))}
      </div>
    }
  >
    <div className='flex h-full max-h-[calc(100dvh-7.75rem)] w-auto max-w-full aspect-[9/16] flex-col overflow-hidden rounded-panel'>
      <Skeleton className='h-10 w-full rounded-t-lg' />
      <Skeleton className='min-h-0 flex-1 rounded-b-lg border border-surface-border/70' />
    </div>
  </DisplayViewerLayout>
)
