import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbsSkeleton } from '@/shared/ui/page/page-breadcrumbs-skeleton'

export const PageHeaderSkeleton = ({
  titleWidth,
  hasTitlePrefix = false,
  hasParent = false,
  includeOrchestratorBreadcrumb = true,
  actionCount = 0,
  titleActionCount = 0
}: {
  titleWidth: string
  hasTitlePrefix?: boolean
  hasParent?: boolean
  includeOrchestratorBreadcrumb?: boolean
  actionCount?: number
  titleActionCount?: number
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <div className='grid gap-3'>
      <PageBreadcrumbsSkeleton
        className='pt-0'
        itemWidths={[
          'w-16',
          ...(includeOrchestratorBreadcrumb ? ['w-24'] : []),
          ...(hasParent ? ['w-20'] : []),
          'w-28'
        ]}
      />
      <div className='grid gap-2 pt-4'>
        <div className='flex min-w-0 items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <Visible when={hasTitlePrefix}>
              <Skeleton className='size-7 rounded-sm max-sm:size-5' />
            </Visible>
            <Skeleton className={`h-10 ${titleWidth} max-sm:h-8`} />
          </div>
          <Visible when={titleActionCount > 0}>
            <div className='flex shrink-0 flex-wrap gap-2'>
              {Array.from({ length: titleActionCount }).map((_, index) => (
                <Skeleton
                  key={index}
                  className='h-10 w-10'
                />
              ))}
            </div>
          </Visible>
        </div>
        <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        <Visible when={actionCount > 0}>
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: actionCount }).map((_, index) => (
              <Skeleton
                key={index}
                className='h-10 w-28'
              />
            ))}
          </div>
        </Visible>
      </div>
    </div>
  </section>
)
