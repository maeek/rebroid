import { Skeleton } from '@/components/ui/skeleton'

export const PageHeaderSkeleton = ({
  titleWidth,
  hasParent = false,
  actionCount = 0
}: {
  titleWidth: string
  hasParent?: boolean
  actionCount?: number
}) => (
  <section className='shrink-0 bg-background px-6 py-4 max-sm:px-4'>
    <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
      <div className='flex flex-col gap-2'>
        <Skeleton className={hasParent ? 'h-3 w-52' : 'h-3 w-36'} />
        <div className='flex flex-col gap-2 pt-4'>
          <Skeleton className={`h-10 ${titleWidth} max-sm:h-8`} />
          <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        </div>
      </div>
      {actionCount > 0 ? (
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: actionCount }).map((_, index) => (
            <Skeleton
              key={index}
              className='h-10 w-28'
            />
          ))}
        </div>
      ) : null}
    </div>
  </section>
)
