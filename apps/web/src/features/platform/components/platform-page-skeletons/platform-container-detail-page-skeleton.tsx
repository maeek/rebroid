'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { DetailRowsSkeleton } from './detail-rows-skeleton'
import { JsonBlockSkeleton } from './json-block-skeleton'

export const PlatformContainerDetailPageSkeleton = ({ titleWidth }: { titleWidth: string }) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Runtime' }}
      trail={[{ label: 'Containers', href: '/runtime/containers' }]}
      title={<Skeleton className={`h-8 ${titleWidth}`} />}
      description='Inspect container configuration, live resources, related runtime objects, and logs.'
    />
    <PageContent>
      <Section
        surface='plain'
        contentClassName='gap-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 flex-col gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <Skeleton className='h-6 w-18 rounded-full' />
              <Skeleton className='h-6 w-20 rounded-full' />
            </div>
            <Skeleton className='h-3 w-44' />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-10 w-24' />
            <Skeleton className='h-10 w-28' />
          </div>
        </div>
        <div className='grid gap-6 xl:grid-cols-2'>
          <DetailRowsSkeleton rows={5} />
          <DetailRowsSkeleton rows={5} />
        </div>
      </Section>

      <Section
        title='Live resources'
        surface='plain'
        contentClassName='gap-4'
      >
        <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className='h-28 rounded-control'
            />
          ))}
        </div>
      </Section>

      <div className='grid gap-6 xl:grid-cols-2'>
        <Section
          title='Related image'
          surface='plain'
          contentClassName='gap-3'
        >
          <DetailRowsSkeleton rows={3} />
        </Section>
        <Section
          title='Related networks'
          surface='panel'
          contentClassName='gap-3'
        >
          <DataGrid
            {...createDataGridLoadingProps({
              minWidth: '32rem',
              rows: 3,
              selectable: false,
              rowMenu: false,
              columns: [
                { width: 'minmax(12rem,1.5fr)', headerWidth: 'w-20', kind: 'stacked' },
                { width: 'minmax(8rem,1fr)', headerWidth: 'w-16', kind: 'text' },
                { width: 'minmax(10rem,1.2fr)', headerWidth: 'w-20', kind: 'text' }
              ]
            })}
          />
        </Section>
      </div>

      <Section
        title='Logs'
        surface='plain'
        contentClassName='gap-4'
      >
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <Skeleton className='h-4 w-full max-w-md opacity-70' />
          <Skeleton className='h-10 w-24' />
        </div>
        <JsonBlockSkeleton
          lines={14}
          dark
        />
      </Section>

      <Section
        title='Labels'
        surface='plain'
        contentClassName='gap-4'
        headingSpacing='default'
      >
        <JsonBlockSkeleton lines={8} />
      </Section>

      <Section
        title='Raw inspect'
        surface='plain'
        collapsible
        contentClassName='gap-4'
      >
        <JsonBlockSkeleton lines={12} />
      </Section>
    </PageContent>
  </StandardPage>
)

export const RuntimeContainerDetailPageLoading = () => (
  <PlatformContainerDetailPageSkeleton titleWidth='w-56 max-sm:w-40' />
)
