import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbsSkeleton } from '@/shared/ui/page/page-breadcrumbs-skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'

const BoxedSectionSkeleton = ({ titleWidth = 'w-32', children }: { titleWidth?: string; children?: ReactNode }) => (
  <div className='rounded-lg border border-border/70 bg-card/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-sm:p-4'>
    <Skeleton className={`mb-4 h-5 ${titleWidth}`} />
    {children}
  </div>
)

export const SystemSettingsPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <section className='shrink-0 px-6 py-4 max-sm:px-4'>
      <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
        <div className='flex flex-col gap-2'>
          <PageBreadcrumbsSkeleton
            className='pt-0'
            itemWidths={['w-24', 'w-16']}
          />
          <Skeleton className='mt-4 h-9 w-28 max-sm:h-7' />
        </div>
      </div>
    </section>
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-6 xl:grid-cols-2'>
        <BoxedSectionSkeleton titleWidth='w-28'>
          <div className='grid gap-3'>
            <Skeleton className='h-4 w-full max-w-xl opacity-70' />
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className='flex items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0'
              >
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-32' />
              </div>
            ))}
          </div>
        </BoxedSectionSkeleton>
        <BoxedSectionSkeleton titleWidth='w-40'>
          <div className='grid gap-3'>
            <Skeleton className='h-4 w-full max-w-xl opacity-70' />
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className='flex items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0'
              >
                <Skeleton className='h-4 w-36' />
                <Skeleton className='h-4 w-24' />
              </div>
            ))}
          </div>
        </BoxedSectionSkeleton>
      </div>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='grid gap-3 rounded-lg border border-border/70 bg-card/40 p-4'
          >
            <Skeleton className='h-3 w-28' />
            <Skeleton className='h-7 w-20' />
            <Skeleton className='h-3 w-full opacity-70' />
          </div>
        ))}
      </div>
      <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]'>
        <BoxedSectionSkeleton titleWidth='w-28'>
          <Skeleton className='mx-auto size-64 rounded-full max-sm:size-48' />
        </BoxedSectionSkeleton>
        <BoxedSectionSkeleton titleWidth='w-36'>
          <div className='flex h-160 items-end gap-2 max-lg:h-96'>
            {Array.from({ length: 24 }).map((_, index) => (
              <Skeleton
                key={index}
                className='w-full'
                style={{ height: `${24 + ((index * 19) % 62)}%` }}
              />
            ))}
          </div>
        </BoxedSectionSkeleton>
      </div>
    </section>
  </ProtectedStackPageLayout>
)
