import { Skeleton } from '@/components/ui/skeleton'

export const DetailRowsSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className='grid grid-cols-[11rem_minmax(0,1fr)] gap-4 py-3 max-sm:grid-cols-1 max-sm:gap-1'
      >
        <Skeleton className='h-4 w-24' />
        <div className='flex justify-end max-sm:justify-start'>
          <Skeleton className='h-4 w-[72%]' />
        </div>
      </div>
    ))}
  </div>
)
