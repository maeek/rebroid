import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'

export const ActivityPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-28'
      includeOrchestratorBreadcrumb={false}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='grid gap-3 rounded-lg border border-border/70 bg-card/40 p-4'
          >
            <Skeleton className='h-3 w-28' />
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
      </div>
    </section>
  </ProtectedStackPageLayout>
)
