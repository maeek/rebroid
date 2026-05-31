import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/page-header-skeleton'
import { TableSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/table-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import type { ListColumn } from '@/features/orchestrator/components/orchestrator-page-skeletons/orchestrator-page-skeleton-types'

export const OperationalSettingsSkeleton = ({
  title,
  columns,
  minWidth
}: {
  title: string
  columns: ListColumn[]
  minWidth: string
}) => (
  <Section
    title={title}
    boxed
    titleClassName='pb-4'
    contentClassName='gap-5'
  >
    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4'>
      <div className='flex items-center gap-3'>
        <Skeleton className='h-6 w-16 rounded-full' />
        <Skeleton className='h-4 w-56 max-sm:w-36' />
      </div>
      <Skeleton className='h-9 w-24' />
    </div>
    <TableSkeleton
      columns={columns}
      minWidth={minWidth}
      rows={4}
    />
  </Section>
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
  <ProtectedStackPageLayout mainClassName='gap-2'>
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
  </ProtectedStackPageLayout>
)
