import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbsSkeleton } from '@/shared/ui/page/page-breadcrumbs-skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'

const AutomationHeaderSkeleton = ({
  breadcrumbWidths = ['w-24', 'w-24'],
  titleWidth = 'w-36',
  actionWidth = 'w-28'
}: {
  breadcrumbWidths?: string[]
  titleWidth?: string
  actionWidth?: string
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <div className='grid gap-3'>
      <PageBreadcrumbsSkeleton
        className='pt-0'
        itemWidths={breadcrumbWidths}
      />
      <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
        <div className='grid gap-2'>
          <Skeleton className={`h-9 ${titleWidth} max-sm:h-7`} />
          <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        </div>
        <Skeleton className={`h-10 ${actionWidth} max-sm:w-full`} />
      </div>
    </div>
  </section>
)

export const AutomationsListPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <AutomationHeaderSkeleton />
    <section className='px-6 pb-16 pt-4 max-sm:px-4'>
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <Skeleton className='h-10 w-full max-w-md' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
      </div>
      <TableSkeleton
        columns={[
          { headerWidth: 'w-20', cellWidth: 'w-48', kind: 'stacked' },
          { headerWidth: 'w-12', cellWidth: 'w-36' },
          { headerWidth: 'w-16', kind: 'badge' },
          { headerWidth: 'w-20', cellWidth: 'w-28' },
          { headerWidth: 'w-16', cellWidth: 'w-24' }
        ]}
        rows={6}
      />
    </section>
  </ProtectedStackPageLayout>
)

export const AutomationTriggersPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <AutomationHeaderSkeleton
      breadcrumbWidths={['w-24', 'w-20']}
      titleWidth='w-32'
      actionWidth='w-32'
    />
    <section className='px-6 pb-16 pt-4 max-sm:px-4'>
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <Skeleton className='h-10 w-full max-w-md' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
      </div>
      <TableSkeleton
        columns={[
          { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
          { headerWidth: 'w-20', cellWidth: 'w-40' },
          { headerWidth: 'w-16', cellWidth: 'w-36' },
          { headerWidth: 'w-14', kind: 'badge' },
          { headerWidth: 'w-20', cellWidth: 'w-24' }
        ]}
        rows={6}
      />
    </section>
  </ProtectedStackPageLayout>
)

export const AutomationEditorPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <AutomationHeaderSkeleton
      breadcrumbWidths={['w-24', 'w-24', 'w-36']}
      titleWidth='w-56'
      actionWidth='w-64'
    />
    <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.75fr)]'>
      <div className='grid content-start gap-6'>
        <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
          <Skeleton className='mb-5 h-5 w-24' />
          <div className='grid gap-4 md:grid-cols-2'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='grid gap-2'
              >
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-10 w-full' />
              </div>
            ))}
          </div>
        </div>
        <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
          <div className='mb-5 flex items-center justify-between gap-3'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-9 w-28' />
          </div>
          <div className='grid gap-3'>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={index}
                className='h-16 w-full'
              />
            ))}
          </div>
        </div>
      </div>
      <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
        <Skeleton className='mb-5 h-5 w-28' />
        <div className='grid gap-4'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
      </div>
    </section>
  </ProtectedStackPageLayout>
)

export const AutomationTracesPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-0'>
    <AutomationHeaderSkeleton
      breadcrumbWidths={['w-24', 'w-24', 'w-36', 'w-16']}
      titleWidth='w-64'
      actionWidth='hidden'
    />
    <section className='grid gap-6 px-6 pb-16 pt-2 max-sm:px-4'>
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-10 w-full max-w-md' />
          <Skeleton className='h-10 w-28' />
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-16', cellWidth: 'w-32' },
            { headerWidth: 'w-20', cellWidth: 'w-44' },
            { headerWidth: 'w-16', kind: 'badge' },
            { headerWidth: 'w-20', cellWidth: 'w-24' },
            { headerWidth: 'w-20', cellWidth: 'w-36' }
          ]}
          rows={6}
        />
      </div>
    </section>
  </ProtectedStackPageLayout>
)
