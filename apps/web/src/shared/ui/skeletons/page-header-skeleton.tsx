import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'

export const PageHeaderSkeleton = ({
  titleWidth,
  hasLeading = false,
  hasParent = false,
  includeOrchestratorBreadcrumb = true,
  actionCount = 0,
  titleActionCount = 0
}: {
  titleWidth: string
  hasLeading?: boolean
  hasParent?: boolean
  includeOrchestratorBreadcrumb?: boolean
  actionCount?: number
  titleActionCount?: number
}) => {
  const trailWidths = [...(includeOrchestratorBreadcrumb ? ['w-24'] : []), ...(hasParent ? ['w-20'] : [])]
  const breadcrumbSkeleton = (width: string) => ({
    label: (
      <Skeleton
        as='span'
        className={`block h-5 ${width}`}
      />
    )
  })
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
      section={breadcrumbSkeleton('w-16')}
      trail={trailWidths.map(breadcrumbSkeleton)}
      breadcrumbLabel={breadcrumbSkeleton('w-28').label}
      title={
        <Skeleton
          as='span'
          className={`block h-9 ${titleWidth} max-sm:h-7`}
        />
      }
      leading={
        hasLeading ? (
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
