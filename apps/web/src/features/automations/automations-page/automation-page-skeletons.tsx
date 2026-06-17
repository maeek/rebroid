import { Skeleton } from '@/components/ui/skeleton'
import { panelSurfaceClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'
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
      <div className='flex items-center justify-between gap-3 max-sm:flex-wrap'>
        <div className='grid gap-2'>
          <Skeleton className={`h-9 ${titleWidth} max-sm:h-7`} />
          <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        </div>
        <Skeleton className={`h-10 ${actionWidth}`} />
      </div>
    </div>
  </section>
)

export const AutomationsListPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <AutomationHeaderSkeleton />
    <section className='px-6 pb-16 pt-2 max-sm:px-4'>
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
    <section className='px-6 pb-16 pt-2 max-sm:px-4'>
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
  <ProtectedStackPageLayout mainClassName='gap-0'>
    <AutomationHeaderSkeleton
      breadcrumbWidths={['w-24', 'w-24', 'w-36']}
      titleWidth='w-56'
      actionWidth='w-64'
    />
    <section className='grid gap-6 px-6 pb-16 pt-2 max-sm:px-4'>
      <div className='flex min-w-0 items-start gap-6 max-[1280px]:flex-wrap'>
        <div className='grid min-w-0 content-start gap-6 flex-2/5'>
          <section className='flex w-full flex-col gap-4 pb-4'>
            <div className='flex h-8 items-center justify-between gap-3'>
              <Skeleton className='h-7 w-24' />
            </div>
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-10 w-full' />
              </div>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-24 w-full' />
              </div>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-14' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
            </div>
          </section>

          <section className='grid min-w-0 content-start gap-3'>
            <div className='flex h-8 items-center justify-between gap-3'>
              <Skeleton className='h-7 w-20' />
            </div>
            <div className='grid min-w-0 gap-2 rounded-md'>
              <div className='relative grid min-h-10 gap-2'>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    data-automation-step-item='true'
                    className='grid min-h-14 rounded-md border border-border/60 bg-surface-panel/45'
                  >
                    <div className='grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5'>
                      <Skeleton className='size-8 rounded-md' />
                      <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-1 py-1'>
                        <Skeleton className='size-8 rounded-md' />
                        <span className='grid min-w-0 gap-1'>
                          <Skeleton className='h-4 w-44 max-w-full' />
                          <Skeleton className='h-3 w-64 max-w-full' />
                        </span>
                      </div>
                      <div className='flex items-center gap-0.5'>
                        <Skeleton className='size-8 rounded-md' />
                        <Skeleton className='size-8 rounded-md' />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
          </section>
        </div>

        <div className='sticky top-24 grid max-h-[calc(100dvh-7rem)] min-w-0 content-start gap-6 overflow-hidden flex-3/5 shrink-0'>
          <aside className='hidden min-w-0 xl:block'>
            <div className={cn('overflow-hidden rounded-lg', panelSurfaceClassName)}>
              <div className='grid max-h-[calc(100dvh-7rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)]'>
                <div className='flex min-h-14 items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
                  <div className='grid min-w-0 gap-1'>
                    <Skeleton className='h-5 w-36' />
                    <Skeleton className='h-3 w-48' />
                  </div>
                  <Skeleton className='size-9 rounded-md' />
                </div>
                <div className='grid gap-4 px-4 py-4'>
                  {Array.from({ length: 5 }).map((_, index) => (
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
            </div>
          </aside>
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
