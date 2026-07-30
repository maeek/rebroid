'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { DetailRowsSkeleton } from './detail-rows-skeleton'
import { JsonBlockSkeleton } from './json-block-skeleton'

export const PlatformResourceDetailPageSkeleton = ({
  titleWidth,
  actionCount = 1,
  badgeCount = 1,
  relatedColumns = 4
}: {
  titleWidth: string
  actionCount?: number
  badgeCount?: number
  relatedColumns?: number
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Runtime' }}
      title={<Skeleton className={`h-8 ${titleWidth}`} />}
      description='Inspect runtime metadata and related containers.'
    />
    <PageContent>
      <Section
        title='Overview'
        surface='plain'
        contentClassName='gap-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 flex-col gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              {Array.from({ length: badgeCount }).map((_, index) => (
                <Skeleton
                  key={index}
                  className='h-6 w-16 rounded-full'
                />
              ))}
              <Skeleton className='h-3 w-28' />
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: actionCount }).map((_, index) => (
              <Skeleton
                key={index}
                className='h-10 w-28'
              />
            ))}
          </div>
        </div>
        <div className='grid gap-6 xl:grid-cols-2'>
          <DetailRowsSkeleton rows={3} />
          <DetailRowsSkeleton rows={3} />
        </div>
      </Section>

      <Section
        title='Related containers'
        surface='plain'
        contentClassName='gap-4'
        headingSpacing='default'
      >
        <DataGrid
          {...createDataGridLoadingProps({
            minWidth: '48rem',
            rows: 4,
            selectable: false,
            rowMenu: false,
            columns: Array.from({ length: relatedColumns }).map((_, index) => {
              let width = 'minmax(10rem,1fr)'
              if (index === 0) width = 'minmax(12rem,2fr)'
              if (index === relatedColumns - 1) width = '10rem'

              let kind: 'stacked' | 'actions' | 'text' = 'text'
              if (index === 0) kind = 'stacked'
              if (index === relatedColumns - 1) kind = 'actions'

              return {
                width,
                headerWidth: index === relatedColumns - 1 ? 'w-16' : 'w-20',
                kind,
                cellWidth: index === 1 ? 'w-20' : 'w-[70%]'
              }
            })
          })}
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

export const RuntimeNetworkDetailPageLoading = () => (
  <PlatformResourceDetailPageSkeleton
    titleWidth='w-48 max-sm:w-36'
    actionCount={1}
    badgeCount={2}
    relatedColumns={4}
  />
)

export const RuntimeImageDetailPageLoading = () => (
  <PlatformResourceDetailPageSkeleton
    titleWidth='w-64 max-sm:w-44'
    actionCount={1}
    badgeCount={1}
    relatedColumns={4}
  />
)
