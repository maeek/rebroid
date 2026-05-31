import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export const AppPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-6'>
    <section className='flex w-full items-center gap-4 px-6 pt-5 max-sm:px-4'>
      <Skeleton className='size-14 rounded-2xl' />
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-5 w-24 rounded-full' />
      </div>
    </section>
    <section className='grid w-full grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)] gap-6 px-6 pb-16 max-lg:grid-cols-1 max-sm:px-4'>
      <div className='flex flex-col gap-5'>
        <Skeleton className='h-36 w-full rounded-xl' />
        <Skeleton className='h-72 w-full rounded-xl' />
      </div>
      <Skeleton className='h-[32rem] w-full rounded-xl' />
    </section>
  </ProtectedStackPageLayout>
)
