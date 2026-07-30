'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const SecurityNetworkPoliciesPageLoading = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Security' }}
      title='Network policies'
      description='Apply outbound network restrictions to application containers.'
    />
    <PageContent>
      <Surface
        level='band'
        tone='success'
        className='flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3'
      >
        <div className='flex items-center gap-3'>
          <Skeleton className='h-6 w-16 rounded-full' />
          <Skeleton className='h-4 w-56 max-sm:w-36' />
        </div>
      </Surface>
      <Section
        surface='plain'
        title='Network policies'
        headingSpacing='compact'
        contentClassName='gap-4'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-9 w-full max-w-md' />
          <Skeleton className='h-9 w-36' />
        </div>
        <DataGrid
          {...createDataGridLoadingProps({
            minWidth: '58rem',
            rows: 4,
            columns: [
              { width: '14rem', headerWidth: 'w-20', kind: 'text' },
              { width: '8rem', headerWidth: 'w-14', kind: 'text' },
              { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
              { width: '8rem', headerWidth: 'w-14', kind: 'text' },
              { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
              { width: '10rem', headerWidth: 'w-14', kind: 'actions' }
            ]
          })}
        />
      </Section>
    </PageContent>
  </StandardPage>
)
