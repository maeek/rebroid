import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export const AppsPageSkeleton = () => {
  return (
    <ProtectedStackPageLayout>
      <div className='w-full'>
        <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
          <Skeleton className='h-9 w-48 max-sm:h-7 max-sm:w-32' />
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-28' />
            <Skeleton className='h-9 w-24' />
          </div>
        </div>
        <div className='px-6 py-8 max-sm:px-4'>
          <div className='grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-4 gap-y-8'>
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className='flex flex-col items-center gap-3 p-2'
              >
                <Skeleton className='size-20 rounded-3xl' />
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-5 w-16 rounded-full' />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedStackPageLayout>
  )
}
