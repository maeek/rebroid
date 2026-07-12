import { Skeleton } from '@/components/ui/skeleton'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { AppsGridLayout } from './components/apps-grid-layout'

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
        <AppsGridLayout
          title={
            <Skeleton
              as='span'
              className='block h-5 w-16'
            />
          }
        >
          {Array.from({ length: 14 }).map((_, index) => (
            <div
              key={index}
              className='flex flex-col items-center justify-center gap-2 overflow-hidden p-2'
            >
              <div className='relative size-20 min-[360px]:size-24'>
                <AppIconSkeleton className='absolute top-[50%] left-[50%] size-16 translate-x-[-50%] translate-y-[-50%] min-[360px]:size-20' />
              </div>
              <Skeleton className='h-4 w-full max-w-20' />
              <Skeleton className='h-5 w-16 rounded-full' />
            </div>
          ))}
        </AppsGridLayout>
      </div>
    </div>
  )

  if (!withLayout) {
    return content
  }

  return <StandardPage>{content}</StandardPage>
}
