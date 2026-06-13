import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'

export const AppsPageSkeleton = ({ withLayout = true }: { withLayout?: boolean }) => {
  const content = (
    <div className='w-full'>
      <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
        <Skeleton className='h-9 w-48 max-sm:h-7 max-sm:w-32' />
        <div className='flex items-center gap-2 max-sm:flex-wrap max-sm:justify-end'>
          <Skeleton className='h-9 w-40 max-sm:w-36' />
          <Skeleton className='h-9 w-24' />
        </div>
      </div>
      <div className='flex flex-col gap-10 py-4'>
        <section className='px-2'>
          <div className='mb-3 px-4 max-sm:px-2'>
            <Skeleton className='h-5 w-16' />
          </div>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] gap-x-3 gap-y-10 min-[360px]:grid-cols-4 min-[360px]:gap-x-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 px-4'>
            {Array.from({ length: 14 }).map((_, index) => (
              <div
                key={index}
                className='flex flex-col items-center justify-center gap-2 overflow-hidden p-2'
              >
                <div className='relative size-20 min-[360px]:size-24'>
                  <Skeleton className='absolute top-[50%] left-[50%] size-16 translate-x-[-50%] translate-y-[-50%] rounded-[24%] min-[360px]:size-20' />
                </div>
                <Skeleton className='h-4 w-full max-w-20' />
                <Skeleton className='h-5 w-16 rounded-full' />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )

  if (!withLayout) {
    return content
  }

  return <ProtectedStackPageLayout>{content}</ProtectedStackPageLayout>
}
