import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'
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
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-panel/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
      <div className='flex items-center gap-3'>
        <Skeleton className='h-6 w-16 rounded-full' />
        <Skeleton className='h-4 w-56 max-sm:w-36' />
      </div>
      <Skeleton className='h-9 w-24' />
    </div>
    <Section
      title={title}
      titleClassName='pb-2'
      contentClassName='gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Skeleton className='h-9 w-full max-w-md' />
        <Skeleton className='h-9 w-36' />
      </div>
      <TableSkeleton
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
