import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <Skeleton className='h-9 w-40 max-sm:h-7 max-sm:w-32' />
        <div className='w-full flex items-start gap-8 pt-2 pb-24 max-md:flex-col'>
          <div className='flex flex-col gap-5 flex-3/5 w-full'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='flex flex-col gap-3 w-full'
              >
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-10 w-full' />
              </div>
            ))}
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='shrink-0 flex flex-col gap-4 grow-0 flex-2/5 items-center max-md:w-full'>
            <div className='flex flex-col gap-4 items-center w-full'>
              <Skeleton className='size-56 rounded-4xl' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-4 w-56' />
            </div>
          </div>
        </div>
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
