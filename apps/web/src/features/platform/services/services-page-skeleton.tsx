'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const PlatformServicesPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='Services'
      description='Configure optional sidecar connection and runtime settings. Feature availability is managed separately.'
    />
    <PageContent>
      <div className='grid gap-4'>
        <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        <DataGrid
          {...createDataGridLoadingProps({
            minWidth: '78rem',
            rows: 3,
            selectable: false,
            columns: [
              { width: '20rem', headerWidth: 'w-20', kind: 'stacked' },
              { width: '8rem', headerWidth: 'w-12', kind: 'badge' },
              { width: '22rem', headerWidth: 'w-20', cellWidth: 'w-[80%]' },
              { width: '8rem', headerWidth: 'w-16', cellWidth: 'w-20' },
              { width: '20rem', headerWidth: 'w-16', cellWidth: 'w-[74%]' },
              { width: '7rem', headerWidth: 'w-16', kind: 'action' }
            ]
          })}
        />
      </div>
    </PageContent>
  </StandardPage>
)
