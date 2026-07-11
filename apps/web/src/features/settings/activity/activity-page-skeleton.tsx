import { Skeleton } from '@/components/ui/skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'

export const ActivityPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-28'
      includeOrchestratorBreadcrumb={false}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='grid gap-3 rounded-control border border-surface-border/60 bg-surface-panel/50 p-4 shadow-panel backdrop-blur-md'
          >
            <div className='flex items-center gap-2'>
              <Skeleton className='size-2 rounded-full' />
              <Skeleton className='h-3 w-28' />
            </div>
            <Skeleton className='h-8 w-16' />
            <Skeleton className='h-3 w-full opacity-70' />
          </div>
        ))}
      </div>
      <div className='grid gap-4'>
        <div>
          <Skeleton className='mb-2 h-5 w-24' />
          <Skeleton className='h-3 w-96 max-w-full opacity-70' />
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-10 w-full max-w-md' />
          <Skeleton className='h-10 w-28' />
          <Skeleton className='h-10 w-28' />
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-16', cellWidth: 'w-32' },
            { headerWidth: 'w-16', cellWidth: 'w-36' },
            { headerWidth: 'w-20', cellWidth: 'w-44' },
            { headerWidth: 'w-20', kind: 'badge' },
            { headerWidth: 'w-20', cellWidth: 'w-32' }
          ]}
          rows={7}
        />
        <div className='flex items-center justify-between gap-3'>
          <Skeleton className='h-4 w-40 opacity-70' />
          <div className='flex items-center gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
          </div>
        </div>
      </div>
    </section>
  </StandardPage>
)
