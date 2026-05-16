import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <Skeleton className='h-9 w-40 max-sm:h-7 max-sm:w-32' />
        <div className='grid w-full grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] items-start gap-6 pt-2 pb-24 max-lg:grid-cols-1'>
          <div className='flex w-full flex-col gap-5'>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className='flex w-full flex-col gap-4 rounded-lg border border-border/70 bg-card/55 p-6 backdrop-blur-md max-sm:p-4'
              >
                <Skeleton className='h-5 w-28' />
                <div className='flex flex-col gap-3'>
                  <Skeleton className='h-4 w-36' />
                  <Skeleton className='h-3 w-full max-w-lg opacity-70' />
                  <Skeleton className='h-10 w-full' />
                </div>
                {index === 0 && (
                  <div className='flex flex-col gap-3'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-3 w-full max-w-xl opacity-70' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                )}
              </div>
            ))}
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='flex w-full flex-col gap-4'>
            <div className='flex w-full flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/55 p-6 backdrop-blur-md max-sm:p-4'>
              <Skeleton className='h-5 w-16 self-start' />
              <Skeleton className='h-3 w-full opacity-70' />
              <Skeleton className='size-56 rounded-4xl' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          </div>
        </div>
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
