import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'
import { DetailRowsSkeleton } from './detail-rows-skeleton'
import { JsonBlockSkeleton } from './json-block-skeleton'

export const PlatformResourceDetailPageSkeleton = ({
  titleWidth,
  actionCount = 1,
  badgeCount = 1,
  relatedColumns = 4
}: {
  titleWidth: string
  actionCount?: number
  badgeCount?: number
  relatedColumns?: number
}) => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth={titleWidth}
      hasParent
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <Section
        title='Overview'
        boxed
        contentClassName='gap-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 flex-col gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              {Array.from({ length: badgeCount }).map((_, index) => (
                <Skeleton
                  key={index}
                  className='h-6 w-16 rounded-full'
                />
              ))}
              <Skeleton className='h-3 w-28' />
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: actionCount }).map((_, index) => (
              <Skeleton
                key={index}
                className='h-10 w-28'
              />
            ))}
          </div>
        </div>
        <div className='grid gap-6 xl:grid-cols-2'>
          <DetailRowsSkeleton rows={3} />
          <DetailRowsSkeleton rows={3} />
        </div>
      </Section>

      <Section
        title='Related containers'
        boxed
        contentClassName='gap-4'
        titleClassName='pb-4'
      >
        <TableSkeleton
          minWidth='48rem'
          rows={4}
          columns={Array.from({ length: relatedColumns }).map((_, index) => ({
            width: index === relatedColumns - 1 ? '10rem' : index === 0 ? 'minmax(12rem,2fr)' : 'minmax(10rem,1fr)',
            headerWidth: index === relatedColumns - 1 ? 'w-16' : 'w-20',
            kind: index === 0 ? 'stacked' : index === relatedColumns - 1 ? 'actions' : 'text',
            cellWidth: index === 1 ? 'w-20' : 'w-[70%]'
          }))}
        />
      </Section>

      <Section
        title='Labels'
        boxed
        contentClassName='gap-4'
        titleClassName='pb-4'
      >
        <JsonBlockSkeleton lines={8} />
      </Section>

      <Section
        title='Raw inspect'
        boxed
        contentClassName='gap-4'
      >
        <JsonBlockSkeleton lines={12} />
      </Section>
    </section>
  </ProtectedStackPageLayout>
)
