'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

const castingColumns = [
  { width: '12rem', headerWidth: 'w-20', kind: 'text' },
  { width: '12rem', headerWidth: 'w-14', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '14rem', headerWidth: 'w-24', kind: 'text' },
  { width: '14rem', headerWidth: 'w-14', kind: 'text' },
  { width: '9rem', headerWidth: 'w-14', kind: 'actions' }
] as const

export const PlatformDisplaySessionsPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      trail={[{ label: 'Services', href: '/platform/services' }]}
      title='Display sessions'
      description='Inspect the display service and end active viewer sessions.'
    />
    <PageContent>
      <Surface
        level='band'
        className='flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3'
      >
        <div className='flex items-center gap-3'>
          <Skeleton className='h-6 w-16 rounded-full' />
          <Skeleton className='h-4 w-56 max-sm:w-36' />
        </div>
        <Skeleton className='h-9 w-24' />
      </Surface>
      <Section
        surface='plain'
        title='Sessions'
        headingSpacing='compact'
        contentClassName='gap-4'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-9 w-full max-w-md' />
          <Skeleton className='h-9 w-36' />
        </div>
        <DataGrid
          {...createDataGridLoadingProps({
            columns: [...castingColumns],
            minWidth: '52rem',
            rows: 4
          })}
        />
      </Section>
    </PageContent>
  </StandardPage>
)
