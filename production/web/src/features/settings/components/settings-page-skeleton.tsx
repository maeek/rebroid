import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbsSkeleton } from '@/features/shell/components/page-breadcrumbs-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export const SettingsPageSkeleton = ({
  title,
  sectionTitle,
  rows,
  variant = 'standard'
}: {
  title: string
  sectionTitle: string
  rows: number
  variant?: 'standard' | 'orchestrator'
}) => {
  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='py-4 px-6 max-sm:px-4 flex items-center justify-between gap-3 shrink-0'>
        <div className='flex flex-col gap-2'>
          <span className='sr-only'>{title}</span>
          <PageBreadcrumbsSkeleton itemWidths={['w-16', 'w-24']} />
          <Skeleton className='h-9 w-40 max-sm:h-7 max-sm:w-28' />
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-24 bg-transparent' />
          <Skeleton className='h-10 w-24 bg-transparent' />
        </div>
      </section>
      <section className='px-6 max-sm:px-4 w-full flex flex-col gap-6 pb-16'>
        <Visible when={variant === 'orchestrator'}>
          <div className='flex w-full flex-col gap-4 rounded-lg bg-card/25 p-6 backdrop-blur-md max-sm:p-4'>
            <Skeleton className='h-5 w-28' />
            <Skeleton className='h-3 w-full max-w-3xl opacity-70' />
            <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className='flex flex-col gap-2 rounded-md bg-background/25 p-4'
                >
                  <Skeleton className='h-4 w-36' />
                  <Skeleton className='h-7 w-20' />
                  <Skeleton className='h-3 w-full opacity-70' />
                </div>
              ))}
            </div>
          </div>
        </Visible>
        <div
          className={
            variant === 'orchestrator'
              ? 'grid w-full gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'
              : 'w-full'
          }
        >
          <div className='flex flex-col w-full gap-6'>
            <div className='flex flex-col w-full rounded-lg bg-card/25 p-6 backdrop-blur-md max-sm:p-4'>
              <Skeleton className='h-5 w-36 mb-6' />
              <span className='sr-only'>{sectionTitle}</span>
              <div className='flex flex-col gap-6'>
                {Array.from({ length: rows }).map((_, index) => (
                  <div
                    key={index}
                    className='flex flex-col gap-3 w-full'
                  >
                    <Skeleton className='h-4 w-40' />
                    <Skeleton className='h-3 w-full max-w-2xl opacity-70' />
                    <Skeleton
                      className={variant === 'standard' && index === rows - 1 ? 'h-6 w-12 rounded-full' : 'h-10 w-full'}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Visible when={variant === 'orchestrator'}>
              <div className='flex flex-col w-full rounded-lg bg-card/25 p-6 backdrop-blur-md max-sm:p-4'>
                <Skeleton className='h-5 w-32 mb-6' />
                <div className='flex flex-col gap-6'>
                  <Skeleton className='h-4 w-40' />
                  <Skeleton className='h-10 w-full' />
                </div>
              </div>
            </Visible>
          </div>
          <Visible when={variant === 'orchestrator'}>
            <div className='flex flex-col gap-3 rounded-lg bg-card/25 p-6 backdrop-blur-md max-sm:p-4'>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-3 w-full opacity-70' />
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between gap-4 rounded-md bg-background/25 p-4'
                >
                  <div className='flex flex-1 flex-col gap-2'>
                    <Skeleton className='h-4 w-36' />
                    <Skeleton className='h-3 w-full opacity-70' />
                  </div>
                  <Skeleton className='h-9 w-40 max-sm:w-24' />
                </div>
              ))}
            </div>
          </Visible>
        </div>
      </section>
    </ProtectedStackPageLayout>
  )
}
