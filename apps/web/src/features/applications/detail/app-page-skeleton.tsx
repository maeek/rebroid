import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbsSkeleton } from '@/features/shell/components/page-breadcrumbs-skeleton'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'

export const AppPageSkeleton = () => (
  <ProtectedSplitPageLayout>
    <ProtectedSplitPageContent>
      <PageBreadcrumbsSkeleton itemWidths={['w-16', 'w-32', 'w-20']} />
      <div className='flex w-full items-center justify-between gap-4 max-sm:flex-col max-sm:items-start'>
        <div className='flex min-w-0 items-center gap-4'>
          <Skeleton className='size-14 rounded-2xl' />
          <div className='grid gap-2'>
            <Skeleton className='h-8 w-48 max-sm:h-7' />
            <Skeleton className='h-5 w-24 rounded-full' />
          </div>
        </div>
        <div className='flex gap-2 max-sm:w-full'>
          <Skeleton className='h-10 w-10' />
          <Skeleton className='h-10 w-24 max-sm:flex-1' />
        </div>
      </div>
      <div className='flex w-full min-w-0 flex-col gap-5 pb-24'>
        <div className='grid gap-3 rounded-lg border border-border/70 bg-card/40 p-4 sm:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className='grid gap-2'
            >
              <Skeleton className='h-3 w-20' />
              <Skeleton className='h-5 w-28' />
            </div>
          ))}
        </div>
        <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
          <Skeleton className='mb-5 h-5 w-36' />
          <div className='grid gap-4 md:grid-cols-2'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='grid gap-2'
              >
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-10 w-full' />
              </div>
            ))}
          </div>
        </div>
        <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
          <Skeleton className='mb-5 h-5 w-32' />
          <div className='grid gap-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-28 w-full' />
          </div>
        </div>
        <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
          <Skeleton className='mb-5 h-5 w-16' />
          <Skeleton className='h-72 w-full' />
        </div>
      </div>
    </ProtectedSplitPageContent>
    <div className='flex w-full max-w-[min(100%,42rem)] flex-col items-center justify-start gap-4 max-lg:px-6 max-sm:px-4 lg:sticky lg:top-10 lg:self-start lg:pr-4 lg:pt-6'>
      <Skeleton className='aspect-[9/16] w-full max-w-sm rounded-4xl' />
      <div className='grid w-full max-w-sm gap-3 rounded-lg border border-border/70 bg-card/40 p-4'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
      </div>
    </div>
  </ProtectedSplitPageLayout>
)
