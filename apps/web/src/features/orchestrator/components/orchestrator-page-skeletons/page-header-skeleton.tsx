import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbsSkeleton } from '@/features/shell/components/page-breadcrumbs-skeleton'

export const PageHeaderSkeleton = ({
  titleWidth,
  hasParent = false,
  includeOrchestratorBreadcrumb = true,
  actionCount = 0
}: {
  titleWidth: string
  hasParent?: boolean
  includeOrchestratorBreadcrumb?: boolean
  actionCount?: number
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
      <div className='flex flex-col gap-2'>
        <PageBreadcrumbsSkeleton
          className='pt-0'
          itemWidths={[
            'w-16',
            ...(includeOrchestratorBreadcrumb ? ['w-24'] : []),
            ...(hasParent ? ['w-20'] : []),
            'w-28'
          ]}
        />
        <div className='flex flex-col gap-2 pt-4'>
          <Skeleton className={`h-10 ${titleWidth} max-sm:h-8`} />
          <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        </div>
      </div>
      <Visible when={actionCount > 0}>
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: actionCount }).map((_, index) => (
            <Skeleton
              key={index}
              className='h-10 w-28 bg-transparent'
            />
          ))}
        </div>
      </Visible>
    </div>
  </section>
)
