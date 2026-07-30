'use client'

import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

const UsersHeaderSkeleton = ({
  title,
  description,
  trail = [],
  withAvatar = false
}: {
  title: string
  description: string
  trail?: Array<{ label: string; href?: string }>
  withAvatar?: boolean
}) => (
  <PageHeader
    section={{ label: 'Security' }}
    trail={trail}
    title={title}
    description={description}
    leading={withAvatar ? <Skeleton className='size-12 rounded-full' /> : undefined}
  />
)

export const UsersPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <UsersHeaderSkeleton
      title='Users'
      description='Manage local accounts, roles, group memberships, and password policy.'
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <Skeleton className='h-5 w-32' />
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-10 w-full max-w-md' />
          <Skeleton className='h-10 w-28' />
        </div>
        <DataGrid
          {...createDataGridLoadingProps({
            columns: [
              { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
              { headerWidth: 'w-12', cellWidth: 'w-24' },
              { headerWidth: 'w-16', cellWidth: 'w-36' },
              { headerWidth: 'w-16', kind: 'badge' },
              { headerWidth: 'w-16', kind: 'action' }
            ],
            rows: 6,
            selectable: false,
            rowMenu: false
          })}
        />
      </div>
    </section>
  </StandardPage>
)

export const GroupsPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <UsersHeaderSkeleton
      title='Groups'
      description='Manage reusable roles, quotas, and permission defaults.'
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-10 w-28' />
        </div>
        <DataGrid
          {...createDataGridLoadingProps({
            columns: [
              { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
              { headerWidth: 'w-20', cellWidth: 'w-56' },
              { headerWidth: 'w-12', cellWidth: 'w-20' },
              { headerWidth: 'w-16', kind: 'action' }
            ],
            rows: 5,
            selectable: false,
            rowMenu: false
          })}
        />
      </div>
    </section>
  </StandardPage>
)

export const UserEditPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <UsersHeaderSkeleton
      trail={[{ label: 'Users', href: '/security/users' }]}
      title='Edit user'
      description='Update account details, group membership, permissions, and quotas.'
      withAvatar
    />
    <EditBodySkeleton variant='user' />
  </StandardPage>
)

export const GroupEditPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <UsersHeaderSkeleton
      trail={[{ label: 'Groups', href: '/security/groups' }]}
      title='Edit group'
      description='Update group details, quotas, and inherited permissions.'
    />
    <EditBodySkeleton variant='group' />
  </StandardPage>
)

const FieldSkeleton = ({ tall = false }: { tall?: boolean }) => (
  <div className='grid gap-2'>
    <Skeleton className='h-4 w-24' />
    <Skeleton className={tall ? 'h-25 w-full' : 'h-9 w-full'} />
  </div>
)

const UserAccountSkeleton = () => (
  <Section
    title='Account'
    surface='panel'
    headingSpacing='default'
    contentClassName='gap-5'
  >
    <div className='flex flex-wrap items-center gap-4'>
      <Skeleton className='size-16 rounded-full' />
      <div className='flex flex-1 flex-wrap gap-2'>
        <Skeleton className='h-9 w-32' />
        <Skeleton className='h-9 w-28' />
      </div>
    </div>
    <div className='grid gap-4 md:grid-cols-2'>
      {Array.from({ length: 4 }).map((_, index) => (
        <FieldSkeleton key={index} />
      ))}
    </div>
  </Section>
)

const GroupDetailsSkeleton = () => (
  <Section
    title='Group Details'
    surface='panel'
    headingSpacing='default'
    contentClassName='gap-5'
  >
    <div className='grid gap-4 md:grid-cols-2'>
      <FieldSkeleton />
      <FieldSkeleton />
    </div>
    <FieldSkeleton tall />
  </Section>
)

const GroupMembershipSkeleton = () => (
  <Section
    title='Groups'
    surface='panel'
    headingSpacing='default'
    contentClassName='gap-5'
  >
    <Skeleton className='h-9 w-full' />
    <div className='grid gap-3'>
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className='flex items-center gap-3 border-b border-surface-border/50 pb-3 last:border-0 last:pb-0'
        >
          <Skeleton className='size-4 rounded-control' />
          <div className='grid flex-1 gap-2'>
            <Skeleton className='h-4 w-36' />
            <Skeleton className='h-3 w-56 max-w-full opacity-70' />
          </div>
        </div>
      ))}
    </div>
  </Section>
)

const QuotasSkeleton = () => (
  <Section
    title='Quotas'
    surface='panel'
    headingSpacing='default'
    contentClassName='gap-5'
  >
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className='grid gap-3'
      >
        <div className='grid gap-2'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-3 w-72 max-w-full opacity-70' />
        </div>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-1 w-full' />
      </div>
    ))}
  </Section>
)

const PermissionsSkeleton = () => (
  <Section
    title='Permissions'
    surface='panel'
    headingSpacing='default'
    contentClassName='gap-4'
    className='xl:sticky xl:top-4'
  >
    <Skeleton className='h-9 w-full' />
    <div className='grid gap-3'>
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className='flex items-center justify-between gap-4 border-b border-surface-border/50 py-2 last:border-b-0'
        >
          <div className='grid gap-2'>
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-3 w-56 max-w-full opacity-70' />
          </div>
          <Skeleton className='h-6 w-12 rounded-full' />
        </div>
      ))}
    </div>
  </Section>
)

const EditBodySkeleton = ({ variant }: { variant: 'user' | 'group' }) => (
  <PageContent className='grid xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]'>
    <div className='grid content-start gap-6'>
      {variant === 'user' ? <UserAccountSkeleton /> : <GroupDetailsSkeleton />}
      {variant === 'user' ? <GroupMembershipSkeleton /> : null}
      <QuotasSkeleton />
    </div>
    <PermissionsSkeleton />
  </PageContent>
)
