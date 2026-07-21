import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
import { DataGridSkeleton } from '@/shared/ui/data-grid/data-grid-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import type { ListColumn } from '@/shared/ui/skeletons/list-skeleton-types'

export const OperationalSettingsSkeleton = ({
  title,
  columns,
  minWidth
}: {
  title: string
  columns: ListColumn[]
  minWidth: string
}) => (
  <>
    <Surface
      level='band'
      className='flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3'
    >
      <div className='flex items-center gap-3'>
        <Skeleton className='h-6 w-16 rounded-full' />
        <Skeleton className='h-4 w-56 max-sm:w-36' />
      </div>
      <Skeleton className='h-9 w-24' />
    </Surface>
    <Section
      surface='plain'
      title={title}
      titleClassName='pb-2'
      contentClassName='gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Skeleton className='h-9 w-full max-w-md' />
        <Skeleton className='h-9 w-36' />
      </div>
      <DataGridSkeleton
        columns={columns}
        minWidth={minWidth}
        rows={4}
      />
    </Section>
  </>
)

export const OperationalSettingsPageSkeleton = ({
  titleWidth,
  sectionTitle,
  columns,
  minWidth,
  includeOrchestratorBreadcrumb = true
}: {
  titleWidth: string
  sectionTitle: string
  columns: ListColumn[]
  minWidth: string
  includeOrchestratorBreadcrumb?: boolean
}) => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth={titleWidth}
      includeOrchestratorBreadcrumb={includeOrchestratorBreadcrumb}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <OperationalSettingsSkeleton
        title={sectionTitle}
        columns={columns}
        minWidth={minWidth}
      />
    </section>
  </StandardPage>
)
