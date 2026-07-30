import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

const SettingSkeleton = ({ tall = false }: { tall?: boolean }) => (
  <div className='grid gap-2'>
    <Skeleton className='h-4 w-36' />
    <Skeleton className='h-3 w-full max-w-xl opacity-70' />
    <Skeleton className={tall ? 'h-16 w-full' : 'h-10 w-full'} />
  </div>
)

export const PlatformRuntimePageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='Runtime defaults'
      description='Default runtime settings and maintenance actions for managed Android containers.'
    />
    <PageContent>
      <div className='grid w-full items-start gap-6 xl:grid-cols-2'>
        <section className='grid content-start gap-6'>
          <div className='grid gap-6'>
            <div className='grid gap-2'>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-full max-w-2xl opacity-70' />
            </div>
            <SettingSkeleton />
            <SettingSkeleton />
            <SettingSkeleton />
            <SettingSkeleton />
            <div className='flex items-center justify-between gap-4 rounded-control border border-surface-border/60 bg-surface-band/30 px-4 py-3 max-sm:flex-col max-sm:items-start'>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full max-w-lg opacity-70' />
              </div>
              <Skeleton className='h-6 w-12 rounded-full' />
            </div>
          </div>
        </section>
        <section className='grid content-start gap-4'>
          <div className='grid gap-2'>
            <Skeleton className='h-5 w-28' />
            <Skeleton className='h-4 w-full max-w-lg opacity-70' />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='grid gap-3 rounded-control border border-surface-border/60 bg-surface-band/30 p-4'
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
    </PageContent>
  </StandardPage>
)
