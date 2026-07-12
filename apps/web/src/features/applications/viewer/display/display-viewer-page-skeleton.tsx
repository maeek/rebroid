import { Skeleton } from '@/components/ui/skeleton'

export const DisplayViewerPageSkeleton = () => (
  <main className='relative flex h-screen w-screen flex-col overflow-hidden bg-background'>
    <div className='flex shrink-0 items-center gap-2 px-2 py-2 sm:px-6 sm:py-3'>
      <Skeleton className='h-9 w-28 rounded-control' />
      <Skeleton className='size-9 rounded-full' />
    </div>
    <div className='min-h-0 flex-1 overflow-hidden px-2 py-2 sm:px-6 sm:py-3'>
      <div className='flex h-full w-full items-center justify-center'>
        <div className='flex h-full max-h-[calc(100dvh-7.75rem)] w-auto max-w-full aspect-[9/16] flex-col overflow-hidden rounded-panel'>
          <Skeleton className='h-10 w-full rounded-t-lg' />
          <Skeleton className='min-h-0 flex-1 rounded-b-lg border border-surface-border/70' />
        </div>
      </div>
    </div>
    <div className='flex shrink-0 items-center justify-center gap-2 px-1 pb-2 sm:px-3 sm:pb-3'>
      {Array.from({ length: 10 }).map((_, index) => (
        <Skeleton
          key={index}
          className='size-8 rounded-full'
        />
      ))}
    </div>
  </main>
)
