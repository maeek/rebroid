import { Skeleton } from '@/components/ui/skeleton'
import { DataGridSkeleton } from '@/shared/ui/data-grid'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import type { ListColumn } from '@/shared/ui/skeletons/list-skeleton-types'

export const PlatformInventoryPageSkeleton = ({
  titleWidth,
  columns,
  minWidth,
  actionCount = 1
}: {
  titleWidth: string
  columns: ListColumn[]
  minWidth: string
  actionCount?: number
}) => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth={titleWidth}
      includeOrchestratorBreadcrumb={false}
      titleActionCount={actionCount}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <Skeleton className='h-10 w-full max-w-md' />
          <div className='flex flex-wrap gap-2 max-sm:w-full'>
            <Skeleton className='h-10 w-28 max-sm:flex-1' />
            <Skeleton className='h-10 w-28 max-sm:flex-1' />
          </div>
        </div>
        <DataGridSkeleton
          columns={columns}
          minWidth={minWidth}
        />
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-4 w-48' />
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
          </div>
        </div>
      </div>
    </section>
  </ProtectedStackPageLayout>
)
