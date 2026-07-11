import { Skeleton } from '@/components/ui/skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

export const PlatformOverviewPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-40'
      includeOrchestratorBreadcrumb={false}
      titleActionCount={1}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-4 max-sm:px-4'>
      <div className='grid gap-4'>
        <Skeleton className='h-5 w-24' />
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='rounded-panel border border-surface-border/60 bg-surface-panel/45 px-4 py-3'
            >
              <Skeleton className='h-3 w-24' />
              <Skeleton className='mt-2 h-8 w-20' />
              <Skeleton className='mt-3 h-3 w-full opacity-70' />
            </div>
          ))}
        </div>
      </div>
    </section>
    <section className='grid gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-2'>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className='grid gap-4 rounded-panel border border-surface-border/60 bg-surface-panel/35 p-4'
        >
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-56 w-full' />
        </div>
      ))}
    </section>
  </StandardPage>
)
