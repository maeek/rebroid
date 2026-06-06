import { Skeleton } from '@/components/ui/skeleton'

export const DisplayViewerPageSkeleton = () => (
  <main className='relative flex min-h-screen flex-col overflow-hidden bg-background'>
    <div className='absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 p-2 backdrop-blur-md'>
      <Skeleton className='h-9 w-9' />
      <Skeleton className='h-9 w-9' />
      <Skeleton className='h-9 w-24' />
    </div>
    <div className='absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 p-2 backdrop-blur-md'>
      <Skeleton className='h-9 w-9' />
      <Skeleton className='h-9 w-9' />
      <Skeleton className='h-9 w-9' />
    </div>
    <div className='flex min-h-screen items-center justify-center px-6 py-12'>
      <div className='relative flex w-full max-w-[min(88vw,34rem)] justify-center'>
        <Skeleton className='aspect-[9/16] w-full rounded-4xl border border-border/70' />
        <div className='absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 py-2 backdrop-blur-md'>
          <Skeleton className='h-8 w-8 rounded-full' />
          <Skeleton className='h-8 w-8 rounded-full' />
          <Skeleton className='h-8 w-8 rounded-full' />
          <Skeleton className='h-8 w-8 rounded-full' />
        </div>
      </div>
    </div>
  </main>
)
