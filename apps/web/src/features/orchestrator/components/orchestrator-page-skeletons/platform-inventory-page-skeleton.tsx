import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'
import type { ListColumn } from '@/shared/ui/skeletons/list-skeleton-types'

export const PlatformInventoryPageSkeleton = ({
  titleWidth,
  sectionTitleWidth,
  columns,
  minWidth
}: {
  titleWidth: string
  sectionTitleWidth: string
  columns: ListColumn[]
  minWidth: string
}) => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton titleWidth={titleWidth} />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <Section
        boxed
        title={<Skeleton className={`h-5 ${sectionTitleWidth}`} />}
        titleClassName='pb-4'
        contentClassName='gap-4'
      >
        <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
          <Skeleton className='h-4 w-full max-w-2xl opacity-70' />
          <Skeleton className='h-10 w-24 shrink-0' />
        </div>
        <Skeleton className='h-10 w-full max-w-md' />
        <TableSkeleton
          columns={columns}
          minWidth={minWidth}
        />
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-4 w-48' />
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
          </div>
        </div>
      </Section>
    </section>
  </ProtectedStackPageLayout>
)
