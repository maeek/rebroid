import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

const SettingSkeleton = ({ tall = false }: { tall?: boolean }) => (
  <div className='grid gap-2'>
    <Skeleton className='h-4 w-36' />
    <Skeleton className='h-3 w-full max-w-xl opacity-70' />
    <Skeleton className={tall ? 'h-16 w-full' : 'h-10 w-full'} />
  </div>
)

export const PlatformRuntimePageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-48'
      includeOrchestratorBreadcrumb={false}
      actionCount={2}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid w-full gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'>
        <section className='grid content-start gap-6'>
          <div className='grid gap-5 rounded-lg border border-border/60 bg-surface-panel/35 p-5 max-sm:p-4'>
            <div className='grid gap-2'>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-full max-w-2xl opacity-70' />
            </div>
            <SettingSkeleton />
            <SettingSkeleton />
            <div className='grid gap-5 md:grid-cols-2'>
              <SettingSkeleton />
              <SettingSkeleton />
            </div>
            <div className='flex items-center justify-between gap-4 rounded-md border border-border/60 bg-surface-band/30 px-4 py-3 max-sm:flex-col max-sm:items-start'>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full max-w-lg opacity-70' />
              </div>
              <Skeleton className='h-6 w-12 rounded-full' />
            </div>
          </div>
        </section>
        <section className='grid content-start gap-4 rounded-lg border border-border/60 bg-surface-panel/35 p-5 max-sm:p-4'>
          <div className='grid gap-2'>
            <Skeleton className='h-5 w-28' />
            <Skeleton className='h-4 w-full max-w-lg opacity-70' />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='grid gap-3 rounded-md border border-border/60 bg-surface-band/30 p-4'
            >
              <div className='flex items-center justify-between gap-3'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-9 w-24' />
              </div>
              <Skeleton className='h-3 w-full opacity-70' />
            </div>
          ))}
        </section>
      </div>
    </section>
  </ProtectedStackPageLayout>
)
