import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbsSkeleton } from '@/shared/ui/page/page-breadcrumbs-skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { TableSkeleton } from '@/shared/ui/skeletons/table-skeleton'

const UsersHeaderSkeleton = ({
  itemWidths = ['w-16', 'w-16'],
  titleWidth = 'w-24',
  actionWidth = 'w-28',
  withAvatar = false
}: {
  itemWidths?: string[]
  titleWidth?: string
  actionWidth?: string
  withAvatar?: boolean
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <PageBreadcrumbsSkeleton
      className='pt-0'
      itemWidths={itemWidths}
    />
    <div className='flex items-center justify-between gap-3 pt-4 max-sm:flex-col max-sm:items-start'>
      <div className='flex min-w-0 items-center gap-4'>
        {withAvatar ? <Skeleton className='size-12 rounded-full' /> : null}
        <div className='grid gap-2'>
          <Skeleton className={`h-9 ${titleWidth} max-sm:h-7`} />
          <Skeleton className='h-4 w-96 max-w-full opacity-70' />
        </div>
      </div>
      <Skeleton className={`h-10 ${actionWidth}`} />
    </div>
  </section>
)

export const UsersPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <UsersHeaderSkeleton />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <Skeleton className='h-5 w-32' />
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-10 w-full max-w-md' />
          <Skeleton className='h-10 w-28' />
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
            { headerWidth: 'w-12', cellWidth: 'w-24' },
            { headerWidth: 'w-16', cellWidth: 'w-36' },
            { headerWidth: 'w-16', kind: 'badge' },
            { headerWidth: 'w-16', kind: 'action' }
          ]}
          rows={6}
        />
      </div>
    </section>
  </ProtectedStackPageLayout>
)

export const GroupsPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <UsersHeaderSkeleton
      itemWidths={['w-16', 'w-20']}
      titleWidth='w-28'
      actionWidth='hidden'
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-10 w-28' />
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
            { headerWidth: 'w-20', cellWidth: 'w-56' },
            { headerWidth: 'w-12', cellWidth: 'w-20' },
            { headerWidth: 'w-16', kind: 'action' }
          ]}
          rows={5}
        />
      </div>
    </section>
  </ProtectedStackPageLayout>
)

export const UserEditPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <UsersHeaderSkeleton
      itemWidths={['w-16', 'w-16', 'w-28']}
      titleWidth='w-48'
      actionWidth='w-52'
      withAvatar
    />
    <EditBodySkeleton leftTitle='w-24' />
  </ProtectedStackPageLayout>
)

export const GroupEditPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <UsersHeaderSkeleton
      itemWidths={['w-16', 'w-20', 'w-28']}
      titleWidth='w-44'
      actionWidth='w-28'
    />
    <EditBodySkeleton leftTitle='w-32' />
  </ProtectedStackPageLayout>
)

const EditBodySkeleton = ({ leftTitle }: { leftTitle: string }) => (
  <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
    <div className='grid content-start gap-6'>
      <div className='rounded-lg border border-border/70 bg-surface-panel/50 p-6 max-sm:p-4'>
        <Skeleton className={`mb-5 h-5 ${leftTitle}`} />
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
      <div className='rounded-lg border border-border/70 bg-surface-panel/50 p-6 max-sm:p-4'>
        <Skeleton className='mb-5 h-5 w-20' />
        <div className='grid gap-4 md:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='grid gap-2'
            >
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-10 w-full' />
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className='rounded-lg border border-border/70 bg-surface-panel/50 p-6 max-sm:p-4'>
      <Skeleton className='mb-5 h-5 w-28' />
      <div className='grid gap-3'>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className='flex items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0'
          >
            <div className='grid gap-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-3 w-56 max-w-full opacity-70' />
            </div>
            <Skeleton className='h-6 w-12 rounded-full' />
          </div>
        ))}
      </div>
    </div>
  </section>
)
