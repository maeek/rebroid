import { Skeleton } from '@/components/ui/skeleton'

export const PageBreadcrumbsSkeleton = ({
  itemWidths,
  className = ''
}: {
  itemWidths: string[]
  className?: string
}) => {
  return (
    <div className={`flex w-full flex-wrap items-center gap-2 ${className}`.trim()}>
      {itemWidths.map((width, index) => (
        <div
          key={`${width}-${index}`}
          className='flex items-center gap-2'
        >
          <Skeleton className={`h-3 ${width}`} />
          {index < itemWidths.length - 1 ? <Skeleton className='h-3 w-3 rounded-full opacity-55' /> : null}
        </div>
      ))}
    </div>
  )
}
