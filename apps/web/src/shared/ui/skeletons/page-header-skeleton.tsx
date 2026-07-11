import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'

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
}) => {
  const breadcrumbWidths = [
    'w-16',
    ...(includeOrchestratorBreadcrumb ? ['w-24'] : []),
    ...(hasParent ? ['w-20'] : []),
    'w-28'
  ]
  const actions = [
    ...Array.from({ length: titleActionCount }, (_, index) => (
      <Skeleton
        key={`title-${index}`}
        className='h-10 w-10'
      />
    )),
    ...Array.from({ length: actionCount }, (_, index) => (
      <Skeleton
        key={`action-${index}`}
        className='h-10 w-28'
      />
    ))
  ]

  return (
    <PageHeader
      breadcrumbs={breadcrumbWidths.map(width => ({
        label: (
          <Skeleton
            as='span'
            className={`block h-5 ${width}`}
          />
        )
      }))}
      title={
        <Skeleton
          as='span'
          className={`block h-9 ${titleWidth} max-sm:h-7`}
        />
      }
      titlePrefix={
        hasTitlePrefix ? (
          <Skeleton
            as='span'
            className='block size-7 rounded-control max-sm:size-5'
          />
        ) : undefined
      }
      description={
        <Skeleton
          as='span'
          className='block h-5 w-full max-w-3xl opacity-70'
        />
      }
      actions={
        actions.length > 0 ? <div className='flex flex-wrap items-center justify-end gap-2'>{actions}</div> : null
      }
    />
  )
}
